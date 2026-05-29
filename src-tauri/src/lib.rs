mod types;
mod paths;
mod parse;
mod registry;
mod scanning;
mod operations;
mod watch;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex as StdMutex;

use tauri::{AppHandle, Manager, Runtime};

use paths::AppPaths;
use types::*;

// ── 调试基础设施 ──────────────────────────────────────────────────

/// 全局调试模式开关，通过 set_debug_mode / get_debug_mode 命令控制
static DEBUG_MODE: AtomicBool = AtomicBool::new(false);
/// 调试日志缓冲区（环形队列，超过 MAX_DEBUG_LOGS 自动丢弃最早的记录）
static DEBUG_LOGS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());
/// 调试日志最大条数
const MAX_DEBUG_LOGS: usize = 500;

/// 将一条调试日志推入全局缓冲区
pub(crate) fn push_debug_log(msg: String) {
  if let Ok(mut logs) = DEBUG_LOGS.lock() {
    logs.push(msg);
    let len = logs.len();
    if len > MAX_DEBUG_LOGS {
      logs.drain(0..len - MAX_DEBUG_LOGS);
    }
  }
}

/// 调试日志宏：同时写入缓冲区、发送 Tauri 事件到前端、输出到 stderr
macro_rules! debug_log {
  ($app:expr, $($arg:tt)*) => {{
    let msg = format!($($arg)*);
    let ts = $crate::registry::time_now();
    let full = format!("[{}] {}", ts, msg);
    eprintln!("[skillkit-debug] {}", msg);
    $crate::push_debug_log(full.clone());
    if let Some(app) = $app {
      let _ = app.emit("debug-log", full);
    }
  }};
}
pub(crate) use debug_log;

// ── Tauri 应用入口 ────────────────────────────────────────────────

/// 应用主入口：注册插件、初始化文件监听、绑定所有 IPC 命令
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      // 启动文件系统监听，监控四个平台的 skill 目录变化
      let app_handle = app.handle().clone();
      let watcher = watch::watch_skill_directories(&app_handle)?;
      app.manage(watcher);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      scan_targets,
      scan_registry,
      create_skill,
      install_skill,
      uninstall_skill,
      sync_skill,
      sync_all,
      delete_skill,
      detect_drift,
      repair_drift,
      get_settings,
      get_activity_log,
      scan_platforms,
      sync_platform_skill,
      delete_platform_skill,
      open_external_url,
      install_from_github,
      scan_github_repo,
      install_multiple_from_github,
      set_debug_mode,
      get_debug_mode,
      get_debug_logs,
      clear_debug_logs
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ── Tauri IPC 命令 ────────────────────────────────────────────────
// 每个 #[tauri::command] 对应前端 tauri.ts 中的一个 invoke 调用
// 统一模式：初始化 AppPaths → 调用业务模块 → 记日志 → 返回结果

/// 获取应用设置信息（registry 路径、扫描深度、忽略规则等）
#[tauri::command]
fn get_settings<R: Runtime>(app: AppHandle<R>) -> Result<SettingsInfo, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  Ok(SettingsInfo {
    registry_root: app_paths.registry_root.display().to_string(),
    operations_log: app_paths.operations_log.display().to_string(),
    install_mode: InstallMode::Symlink,
    scan_depth: paths::SETTINGS_SCAN_DEPTH,
    ignore_rules: paths::IGNORE_RULES.iter().map(|value| value.to_string()).collect(),
  })
}

/// 扫描 registry 中所有已注册的 skill
#[tauri::command]
fn scan_registry<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SkillRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)
}

/// 扫描所有平台的 skill 目录，返回每个平台的条目汇总
#[tauri::command]
fn scan_targets<R: Runtime>(app: AppHandle<R>) -> Result<Vec<TargetSummary>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::scan_all_targets(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

/// 扫描所有平台，返回按平台分组的 skill 列表（前端主界面数据源）
#[tauri::command]
fn scan_platforms<R: Runtime>(app: AppHandle<R>) -> Result<Vec<PlatformGroup>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::scan_platform_groups(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

/// 一致性检测：找出 registry 与实际安装不一致的 skill
#[tauri::command]
fn detect_drift<R: Runtime>(app: AppHandle<R>) -> Result<Vec<DriftRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::detect_drift_inner(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

/// 在 registry 中创建新 skill（生成 SKILL.md 骨架 + skill.json）
#[tauri::command]
fn create_skill<R: Runtime>(
  app: AppHandle<R>,
  name: String,
  category: Option<String>,
  description: Option<String>,
  tags: Option<Vec<String>>,
) -> Result<SkillRecord, String> {
  let payload = CreateSkillInput {
    name,
    category,
    description,
    tags,
  };
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let created = operations::create_skill_inner(&app_paths, payload).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("create {}", created.id)).map_err(paths::error_to_string)?;
  Ok(created)
}

/// 将 registry 中的 skill 通过 symlink 安装到指定平台
#[tauri::command]
fn install_skill<R: Runtime>(
  app: AppHandle<R>,
  skill_id: String,
  target: PlatformKind,
) -> Result<SkillRecord, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let updated =
    operations::install_skill_inner(&app_paths, &skill_id, target.clone()).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("install {} {:?}", skill_id, target))
    .map_err(paths::error_to_string)?;
  Ok(updated)
}

/// 从指定平台卸载 skill（删除 symlink 或复制的目录）
#[tauri::command]
fn uninstall_skill<R: Runtime>(
  app: AppHandle<R>,
  skill_id: String,
  target: PlatformKind,
) -> Result<SkillRecord, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let updated =
    operations::uninstall_skill_inner(&app_paths, &skill_id, target.clone()).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("uninstall {} {:?}", skill_id, target))
    .map_err(paths::error_to_string)?;
  Ok(updated)
}

/// 同步单个 skill 到所有已安装的平台（重新创建 symlink）
#[tauri::command]
fn sync_skill<R: Runtime>(app: AppHandle<R>, skill_id: String) -> Result<SkillRecord, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let updated = operations::sync_skill_inner(&app_paths, &skill_id).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("sync {}", skill_id)).map_err(paths::error_to_string)?;
  Ok(updated)
}

/// 同步所有已注册的 skill
#[tauri::command]
fn sync_all<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SkillRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let records = operations::sync_all_inner(&app_paths).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, "sync_all").map_err(paths::error_to_string)?;
  Ok(records)
}

/// 从 registry 彻底删除 skill（清理所有平台安装 + registry 记录）
#[tauri::command]
fn delete_skill<R: Runtime>(app: AppHandle<R>, skill_id: String) -> Result<(), String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  operations::delete_skill_inner(&app_paths, &skill_id).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("delete {}", skill_id)).map_err(paths::error_to_string)?;
  Ok(())
}

/// 修复指定平台的 skill 一致性（重装 symlink）
#[tauri::command]
fn repair_drift<R: Runtime>(
  app: AppHandle<R>,
  skill_id: String,
  target: PlatformKind,
) -> Result<SkillRecord, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let updated =
    operations::repair_drift_inner(&app_paths, &skill_id, target.clone()).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("repair {} {:?}", skill_id, target))
    .map_err(paths::error_to_string)?;
  Ok(updated)
}

/// 读取操作日志（最近 50 条，按时间倒序）
#[tauri::command]
fn get_activity_log<R: Runtime>(app: AppHandle<R>) -> Result<Vec<ActivityEntry>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  registry::read_activity_log(&app_paths).map_err(paths::error_to_string)
}

/// 跨平台同步：在目标平台创建指向源平台 skill 的 symlink
#[tauri::command]
fn sync_platform_skill<R: Runtime>(
  app: AppHandle<R>,
  source_path: String,
  source_platform: PlatformKind,
  target_platform: PlatformKind,
) -> Result<(), String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let source = PathBuf::from(source_path);
  operations::sync_platform_skill_inner(&app_paths, &source, source_platform, target_platform)
    .map_err(paths::error_to_string)?;
  registry::append_log(
    &app_paths,
    &format!("platform_sync {}", source.display()),
  )
  .map_err(paths::error_to_string)?;
  Ok(())
}

/// 删除指定平台上的 skill（可选同时删除 registry 中的管理副本）
#[tauri::command]
fn delete_platform_skill<R: Runtime>(
  app: AppHandle<R>,
  path: String,
  platform: PlatformKind,
  remove_managed_copy: bool,
) -> Result<(), String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  operations::delete_platform_skill_inner(&app_paths, &PathBuf::from(path), platform, remove_managed_copy)
    .map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, "platform_delete").map_err(paths::error_to_string)?;
  Ok(())
}

/// 开关调试模式
#[tauri::command]
fn set_debug_mode(enabled: bool) -> Result<(), String> {
  DEBUG_MODE.store(enabled, Ordering::Relaxed);
  Ok(())
}

/// 读取当前调试模式状态
#[tauri::command]
fn get_debug_mode() -> bool {
  DEBUG_MODE.load(Ordering::Relaxed)
}

/// 获取所有调试日志
#[tauri::command]
fn get_debug_logs() -> Vec<String> {
  DEBUG_LOGS.lock().map(|v| v.clone()).unwrap_or_default()
}

/// 清空调试日志缓冲区
#[tauri::command]
fn clear_debug_logs() -> Result<(), String> {
  DEBUG_LOGS
    .lock()
    .map(|mut v| v.clear())
    .map_err(|e| e.to_string())
}

/// 用系统默认浏览器打开外部 URL
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  tauri_plugin_opener::open_url(url, Option::<String>::None).map_err(|e| format!("failed to open url: {e}"))
}

/// 从 GitHub 仓库安装单个 skill（clone → registry → 各平台复制）
#[tauri::command]
fn install_from_github<R: Runtime>(
  app: AppHandle<R>,
  url: String,
) -> Result<InstallFromGitHubResult, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let result = operations::install_from_github_inner(&app, &app_paths, &url).map_err(paths::error_to_string)?;
  registry::append_log(
    &app_paths,
    &format!("install_from_github {} -> {}", url, result.skill.name),
  )
  .map_err(paths::error_to_string)?;
  Ok(result)
}

/// 扫描 GitHub 仓库，找出所有包含 SKILL.md 的目录（用于安装前预览）
#[tauri::command]
fn scan_github_repo<R: Runtime>(
  app: AppHandle<R>,
  url: String,
) -> Result<GitHubScanResult, String> {
  operations::scan_github_repo_inner(&app, &url).map_err(paths::error_to_string)
}

/// 从 GitHub 仓库批量安装多个 skill（按子路径列表）
#[tauri::command]
fn install_multiple_from_github<R: Runtime>(
  app: AppHandle<R>,
  url: String,
  subpaths: Vec<String>,
) -> Result<Vec<InstallFromGitHubResult>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let results = operations::install_multiple_from_github_inner(&app, &app_paths, &url, &subpaths)
    .map_err(paths::error_to_string)?;
  for result in &results {
    registry::append_log(
      &app_paths,
      &format!("install_from_github {} -> {}", url, result.skill.name),
    )
    .map_err(paths::error_to_string)?;
  }
  Ok(results)
}

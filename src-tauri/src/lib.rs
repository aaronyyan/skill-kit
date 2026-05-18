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

// ── Debug infrastructure ──────────────────────────────────────────

static DEBUG_MODE: AtomicBool = AtomicBool::new(false);
static DEBUG_LOGS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());
const MAX_DEBUG_LOGS: usize = 500;

pub(crate) fn push_debug_log(msg: String) {
  if let Ok(mut logs) = DEBUG_LOGS.lock() {
    logs.push(msg);
    let len = logs.len();
    if len > MAX_DEBUG_LOGS {
      logs.drain(0..len - MAX_DEBUG_LOGS);
    }
  }
}

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

// ── Tauri app entry ───────────────────────────────────────────────

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
      set_debug_mode,
      get_debug_mode,
      get_debug_logs,
      clear_debug_logs
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ── Tauri commands (thin wrappers) ────────────────────────────────

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

#[tauri::command]
fn scan_registry<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SkillRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)
}

#[tauri::command]
fn scan_targets<R: Runtime>(app: AppHandle<R>) -> Result<Vec<TargetSummary>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::scan_all_targets(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

#[tauri::command]
fn scan_platforms<R: Runtime>(app: AppHandle<R>) -> Result<Vec<PlatformGroup>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::scan_platform_groups(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

#[tauri::command]
fn detect_drift<R: Runtime>(app: AppHandle<R>) -> Result<Vec<DriftRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let registry_skills = registry::load_registry_skills(&app_paths).map_err(paths::error_to_string)?;
  scanning::detect_drift_inner(&app_paths, &registry_skills).map_err(paths::error_to_string)
}

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

#[tauri::command]
fn sync_skill<R: Runtime>(app: AppHandle<R>, skill_id: String) -> Result<SkillRecord, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let updated = operations::sync_skill_inner(&app_paths, &skill_id).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("sync {}", skill_id)).map_err(paths::error_to_string)?;
  Ok(updated)
}

#[tauri::command]
fn sync_all<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SkillRecord>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  let records = operations::sync_all_inner(&app_paths).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, "sync_all").map_err(paths::error_to_string)?;
  Ok(records)
}

#[tauri::command]
fn delete_skill<R: Runtime>(app: AppHandle<R>, skill_id: String) -> Result<(), String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  operations::delete_skill_inner(&app_paths, &skill_id).map_err(paths::error_to_string)?;
  registry::append_log(&app_paths, &format!("delete {}", skill_id)).map_err(paths::error_to_string)?;
  Ok(())
}

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

#[tauri::command]
fn get_activity_log<R: Runtime>(app: AppHandle<R>) -> Result<Vec<ActivityEntry>, String> {
  let app_paths = AppPaths::new(&app).map_err(paths::error_to_string)?;
  registry::read_activity_log(&app_paths).map_err(paths::error_to_string)
}

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

#[tauri::command]
fn set_debug_mode(enabled: bool) -> Result<(), String> {
  DEBUG_MODE.store(enabled, Ordering::Relaxed);
  Ok(())
}

#[tauri::command]
fn get_debug_mode() -> bool {
  DEBUG_MODE.load(Ordering::Relaxed)
}

#[tauri::command]
fn get_debug_logs() -> Vec<String> {
  DEBUG_LOGS.lock().map(|v| v.clone()).unwrap_or_default()
}

#[tauri::command]
fn clear_debug_logs() -> Result<(), String> {
  DEBUG_LOGS
    .lock()
    .map(|mut v| v.clear())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  tauri_plugin_opener::open_url(url, Option::<String>::None).map_err(|e| format!("failed to open url: {e}"))
}

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

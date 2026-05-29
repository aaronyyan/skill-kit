use serde::{Deserialize, Serialize};

/// 支持的 AI 编码平台
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Debug)]
#[serde(rename_all = "camelCase")]
pub enum PlatformKind {
  Codex,
  Claude,
  Openclaw,
  Hermes,
}

/// skill 在磁盘上的发现方式
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SkillSourceType {
  Directory, // 普通目录，包含 SKILL.md
  Symlink,   // 指向 skill 目录的符号链接
  Category,  // 分类目录下的子 skill（顶层无 SKILL.md）
}

/// skill 的安装模式
#[derive(Clone, Default, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum InstallMode {
  #[default]
  Symlink, // 通过符号链接安装（registry 模式）
  Copy,    // 复制安装（GitHub 安装模式）
}

/// 一致性检测状态：对比 registry 期望和实际安装
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum DriftStatus {
  Ok,                // 一致
  Missing,           // 目标路径不存在
  BrokenLink,        // 符号链接断裂
  HashMismatch,      // 内容哈希不一致
  UnmanagedConflict, // 目标存在未管理的目录
}

/// 同步状态
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum SyncState {
  Ready,      // 可同步
  Synced,     // 已同步
  Conflict,   // 存在冲突
  Unavailable, // 不可用（如同步方向不支持）
}

/// 单个平台上的安装状态
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTargetStatus {
  pub target: PlatformKind,
  pub installed: bool,
  pub path: String,
  pub link_type: Option<InstallMode>,
  pub drift_status: DriftStatus,
}

/// registry 中的 skill 记录（对应 skill.json）
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRecord {
  pub id: String,
  pub name: String,
  pub category: String,
  pub tags: Vec<String>,
  pub source_path: String,
  pub description: String,
  pub targets: Vec<SkillTargetStatus>,
  pub install_mode: InstallMode,
  pub managed: bool,
  pub hash: String,
  pub created_at: String,
  pub updated_at: String,
}

/// GitHub 安装结果
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallFromGitHubResult {
  pub skill: SkillRecord,
  pub installed_platforms: Vec<PlatformKind>,
}

/// GitHub 仓库扫描结果
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubScanResult {
  pub repo_url: String,
  pub subpath: Option<String>,
  pub skills: Vec<GitHubSkillPreview>,
}

/// 仓库中发现的 skill 预览
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSkillPreview {
  pub name: String,
  pub description: String,
  pub subpath: String,
}

/// 目标平台扫描中的单个 skill 条目
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetSkillEntry {
  pub name: String,
  pub path: String,
  pub managed: bool,
  pub has_skill_file: bool,
  pub is_symlink: bool,
  pub registry_skill_id: Option<String>,
  pub status: DriftStatus,
}

/// 单个平台的扫描汇总
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetSummary {
  pub target: PlatformKind,
  pub root_path: String,
  pub writable: bool,
  pub entries: Vec<TargetSkillEntry>,
}

/// 一致性检测记录
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriftRecord {
  pub skill_id: Option<String>,
  pub skill_name: String,
  pub target: PlatformKind,
  pub path: String,
  pub status: DriftStatus,
  pub message: String,
}

/// 应用设置信息
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInfo {
  pub registry_root: String,
  pub operations_log: String,
  pub install_mode: InstallMode,
  pub scan_depth: usize,
  pub ignore_rules: Vec<String>,
}

/// 操作日志条目
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
  pub timestamp: String,
  pub action: String,
}

/// 同步目标信息
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTargetInfo {
  pub target: PlatformKind,
  pub state: SyncState,
  pub path: Option<String>,
}

/// 平台下的单个 skill 信息，用于前端展示
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSkillItem {
  pub id: String,
  pub name: String,
  pub category: String,
  pub tags: Vec<String>,
  pub description: String,
  pub github_url: Option<String>,
  pub path: String,            // skill 实际目录路径
  pub install_path: String,    // 安装位置（可能是 symlink）
  pub root_label: String,
  pub source_label: String,
  pub source: String,          // 来源：codex / claude-code / skillkit / local
  pub platform: PlatformKind,
  pub source_type: SkillSourceType,
  pub managed_registry_id: Option<String>,
  pub sync_targets: Vec<SyncTargetInfo>,
}

/// 按平台分组的 skill 列表
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformGroup {
  pub platform: PlatformKind,
  pub roots: Vec<String>,
  pub skills: Vec<PlatformSkillItem>,
}

/// 创建 skill 的输入参数
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillInput {
  pub name: String,
  pub category: Option<String>,
  pub description: Option<String>,
  pub tags: Option<Vec<String>>,
}

/// 持久化到 skill.json 的数据结构（保持 snake_case，不走 IPC）
#[derive(Serialize, Deserialize)]
#[serde(default)]
pub struct PersistedSkill {
  pub id: String,
  pub name: String,
  pub category: String,
  pub tags: Vec<String>,
  pub source_path: String,
  pub description: String,
  pub targets: Vec<PlatformKind>,
  pub install_mode: InstallMode,
  pub managed: bool,
  pub hash: String,
  pub created_at: String,
  pub updated_at: String,
  pub github_url: Option<String>,
}

impl Default for PersistedSkill {
  fn default() -> Self {
    Self {
      id: String::new(),
      name: String::new(),
      category: "uncategorized".to_string(),
      tags: Vec::new(),
      source_path: String::new(),
      description: String::new(),
      targets: Vec::new(),
      install_mode: InstallMode::Symlink,
      managed: false,
      hash: String::new(),
      created_at: String::new(),
      updated_at: String::new(),
      github_url: None,
    }
  }
}

/// 文件系统监听事件：skill 变更通知（发送给前端）
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillChangeNotice {
  pub platform: String, // 平台名称
  pub action: String,   // 操作类型：added / removed / changed
}

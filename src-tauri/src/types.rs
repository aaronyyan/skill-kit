use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Debug)]
#[serde(rename_all = "snake_case")]
pub enum PlatformKind {
  Codex,
  Claude,
  Openclaw,
  Hermes,
}

/// How a skill entry was discovered on disk.
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillSourceType {
  /// Regular directory with SKILL.md
  Directory,
  /// Symlink pointing to a skill directory
  Symlink,
  /// Skills found inside a category directory (no SKILL.md at top level)
  Category,
}

#[derive(Clone, Default, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum InstallMode {
  #[default]
  Symlink,
  Copy,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum DriftStatus {
  Ok,
  Missing,
  BrokenLink,
  HashMismatch,
  UnmanagedConflict,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SyncState {
  Ready,
  Synced,
  Conflict,
  Unavailable,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SkillTargetStatus {
  pub target: PlatformKind,
  pub installed: bool,
  pub path: String,
  pub link_type: Option<InstallMode>,
  pub drift_status: DriftStatus,
}

#[derive(Clone, Serialize, Deserialize)]
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

#[derive(Clone, Serialize, Deserialize)]
pub struct InstallFromGitHubResult {
  pub skill: SkillRecord,
  pub installed_platforms: Vec<PlatformKind>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct GitHubScanResult {
  pub repo_url: String,
  pub subpath: Option<String>,
  pub skills: Vec<GitHubSkillPreview>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct GitHubSkillPreview {
  pub name: String,
  pub description: String,
  pub subpath: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TargetSkillEntry {
  pub name: String,
  pub path: String,
  pub managed: bool,
  pub has_skill_file: bool,
  pub is_symlink: bool,
  pub registry_skill_id: Option<String>,
  pub status: DriftStatus,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TargetSummary {
  pub target: PlatformKind,
  pub root_path: String,
  pub writable: bool,
  pub entries: Vec<TargetSkillEntry>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DriftRecord {
  pub skill_id: Option<String>,
  pub skill_name: String,
  pub target: PlatformKind,
  pub path: String,
  pub status: DriftStatus,
  pub message: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SettingsInfo {
  pub registry_root: String,
  pub operations_log: String,
  pub install_mode: InstallMode,
  pub scan_depth: usize,
  pub ignore_rules: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
  pub timestamp: String,
  pub action: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SyncTargetInfo {
  pub target: PlatformKind,
  pub state: SyncState,
  pub path: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PlatformSkillItem {
  pub id: String,
  pub name: String,
  pub category: String,
  pub tags: Vec<String>,
  pub description: String,
  pub github_url: Option<String>,
  pub path: String,
  pub install_path: String,
  pub root_label: String,
  pub source_label: String,
  pub platform: PlatformKind,
  pub source_type: SkillSourceType,
  pub managed_registry_id: Option<String>,
  pub sync_targets: Vec<SyncTargetInfo>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PlatformGroup {
  pub platform: PlatformKind,
  pub roots: Vec<String>,
  pub skills: Vec<PlatformSkillItem>,
}

#[derive(Clone, Deserialize)]
pub struct CreateSkillInput {
  pub name: String,
  pub category: Option<String>,
  pub description: Option<String>,
  pub tags: Option<Vec<String>>,
}

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

#[derive(Clone, Serialize)]
pub struct SkillChangeNotice {
  pub platform: String,
  pub action: String,
}

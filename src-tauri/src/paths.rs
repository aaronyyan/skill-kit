use std::{
  collections::HashMap,
  fs,
  path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager, Runtime};
use walkdir::WalkDir;

use crate::types::PlatformKind;

pub const SETTINGS_SCAN_DEPTH: usize = 4;
pub const IGNORE_RULES: [&str; 2] = [".DS_Store", ".git"];

pub struct AppPaths {
  pub home_dir: PathBuf,
  pub registry_root: PathBuf,
  pub skills_root: PathBuf,
  pub operations_log: PathBuf,
  pub target_roots: HashMap<PlatformKind, PathBuf>,
  pub platform_scan_roots: HashMap<PlatformKind, Vec<PathBuf>>,
}

impl AppPaths {
  pub fn new<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
    let app_root = app
      .path()
      .app_data_dir()
      .context("app data directory unavailable")?;
    let registry_root = app_root.join("registry");
    let skills_root = registry_root.join("skills");
    let operations_log = app_root.join("logs").join("operations.log");
    let home = dirs_next::home_dir().context("home directory unavailable")?;

    let codex_root = home.join(".codex").join("skills");
    let claude_root = home.join(".claude").join("skills");
    let openclaw_root = home.join(".openclaw").join("skills");
    let hermes_root = home.join(".hermes").join("skills");

    let mut target_roots = HashMap::new();
    target_roots.insert(PlatformKind::Codex, codex_root.clone());
    target_roots.insert(PlatformKind::Claude, claude_root.clone());
    target_roots.insert(PlatformKind::Openclaw, openclaw_root.clone());
    target_roots.insert(PlatformKind::Hermes, hermes_root.clone());

    let mut platform_scan_roots = HashMap::new();
    platform_scan_roots.insert(PlatformKind::Codex, vec![codex_root]);
    platform_scan_roots.insert(PlatformKind::Claude, vec![claude_root]);
    platform_scan_roots.insert(PlatformKind::Openclaw, vec![openclaw_root]);
    platform_scan_roots.insert(PlatformKind::Hermes, vec![hermes_root]);

    fs::create_dir_all(&skills_root)?;
    if let Some(parent) = operations_log.parent() {
      fs::create_dir_all(parent)?;
    }
    for root in target_roots.values() {
      let _ = fs::create_dir_all(root);
    }

    Ok(Self {
      home_dir: home,
      registry_root,
      skills_root,
      operations_log,
      target_roots,
      platform_scan_roots,
    })
  }

  #[cfg(test)]
  pub fn from_roots(
    registry_root: PathBuf,
    codex_root: PathBuf,
    claude_root: PathBuf,
  ) -> Result<Self> {
    let skills_root = registry_root.join("skills");
    let operations_log = registry_root.join("logs").join("operations.log");
    let openclaw_root = registry_root.join("openclaw-skills");
    let hermes_root = registry_root.join("hermes-skills");
    let home_dir = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));

    let mut target_roots = HashMap::new();
    target_roots.insert(PlatformKind::Codex, codex_root.clone());
    target_roots.insert(PlatformKind::Claude, claude_root.clone());
    target_roots.insert(PlatformKind::Openclaw, openclaw_root.clone());
    target_roots.insert(PlatformKind::Hermes, hermes_root.clone());

    let mut platform_scan_roots = HashMap::new();
    platform_scan_roots.insert(PlatformKind::Codex, vec![codex_root]);
    platform_scan_roots.insert(PlatformKind::Claude, vec![claude_root]);
    platform_scan_roots.insert(PlatformKind::Openclaw, vec![openclaw_root]);
    platform_scan_roots.insert(PlatformKind::Hermes, vec![hermes_root]);

    fs::create_dir_all(&skills_root)?;
    if let Some(parent) = operations_log.parent() {
      fs::create_dir_all(parent)?;
    }
    for roots in platform_scan_roots.values() {
      for root in roots {
        fs::create_dir_all(root)?;
      }
    }

    Ok(Self {
      home_dir,
      registry_root,
      skills_root,
      operations_log,
      target_roots,
      platform_scan_roots,
    })
  }
}

pub fn target_root<'a>(paths: &'a AppPaths, target: &PlatformKind) -> &'a PathBuf {
  paths
    .target_roots
    .get(target)
    .expect("target root should always exist")
}

pub fn platform_roots(paths: &AppPaths, target: &PlatformKind) -> Vec<PathBuf> {
  paths
    .platform_scan_roots
    .get(target)
    .cloned()
    .unwrap_or_default()
}

pub fn summarize_root_label(paths: &AppPaths, platform: &PlatformKind, root: &Path) -> String {
  let primary = target_root(paths, platform);
  if normalize_path(&primary.display().to_string()) == normalize_path(&root.display().to_string()) {
    return String::new();
  }

  let home = paths.home_dir.display().to_string();
  let display = root.display().to_string();
  let compact = if display.starts_with(&home) {
    display.replacen(&home, "~", 1)
  } else {
    display
  };

  compact
}

pub fn resolve_skill_dir(path: &Path) -> Option<PathBuf> {
  if let Ok(meta) = fs::symlink_metadata(path) {
    if meta.file_type().is_symlink() {
      if let Ok(resolved) = fs::canonicalize(path) {
        return Some(resolved);
      }
    }
  }
  if path.is_dir() {
    return Some(path.to_path_buf());
  }
  None
}

pub fn is_writable(path: &Path) -> bool {
  let probe = path.join(".skillhub-write-test");
  let result = fs::write(&probe, b"probe").is_ok();
  let _ = fs::remove_file(probe);
  result
}

pub fn symlink_metadata_exists(path: &Path) -> bool {
  fs::symlink_metadata(path).is_ok()
}

pub fn copy_dir(source: &Path, destination: &Path) -> Result<()> {
  fs::create_dir_all(destination)?;
  for entry in WalkDir::new(source) {
    let entry = entry?;
    let relative = entry.path().strip_prefix(source)?;
    if relative.as_os_str().is_empty() || should_ignore(relative) {
      continue;
    }
    let target = destination.join(relative);
    if entry.file_type().is_dir() {
      fs::create_dir_all(&target)?;
    } else if entry.file_type().is_file() {
      if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
      }
      fs::copy(entry.path(), &target)?;
    }
  }
  Ok(())
}

#[cfg(unix)]
pub fn create_symlink(source: &Path, target: &Path) -> Result<()> {
  std::os::unix::fs::symlink(source, target)?;
  Ok(())
}

pub fn normalize_path(path: &str) -> String {
  fs::canonicalize(path)
    .map(|value| value.display().to_string())
    .unwrap_or_else(|_| path.to_string())
}

pub fn normalize_existing_path_or_raw(path: &str) -> String {
  if let Ok(canonical) = fs::canonicalize(path) {
    return canonical.display().to_string();
  }

  normalize_lexical_path(path)
}

pub fn normalize_lexical_path(path: &str) -> String {
  let original = Path::new(path);
  let mut normalized = PathBuf::new();

  for component in original.components() {
    match component {
      std::path::Component::CurDir => {}
      std::path::Component::ParentDir => {
        normalized.pop();
      }
      other => normalized.push(other.as_os_str()),
    }
  }

  if normalized.as_os_str().is_empty() {
    path.to_string()
  } else {
    normalized.display().to_string()
  }
}

pub fn expand_tilde(value: &str, home: &Path) -> Result<PathBuf> {
  if let Some(stripped) = value.strip_prefix("~/") {
    Ok(home.join(stripped))
  } else {
    Ok(PathBuf::from(value))
  }
}

pub fn platform_label(platform: &PlatformKind) -> &'static str {
  match platform {
    PlatformKind::Codex => ".codex",
    PlatformKind::Claude => ".claude",
    PlatformKind::Openclaw => ".openclaw",
    PlatformKind::Hermes => ".hermes",
  }
}

pub fn platform_from_path(path: &Path) -> Option<PlatformKind> {
  let path_str = path.to_string_lossy();
  if path_str.contains(".claude") && path_str.contains("skills") {
    Some(PlatformKind::Claude)
  } else if path_str.contains(".codex") && path_str.contains("skills") {
    Some(PlatformKind::Codex)
  } else if path_str.contains(".openclaw") && path_str.contains("skills") {
    Some(PlatformKind::Openclaw)
  } else if path_str.contains(".hermes") && path_str.contains("skills") {
    Some(PlatformKind::Hermes)
  } else {
    None
  }
}

pub fn error_to_string(error: anyhow::Error) -> String {
  format!("{error:#}")
}

fn should_ignore(path: &Path) -> bool {
  path.components().any(|component| {
    IGNORE_RULES.contains(&component.as_os_str().to_string_lossy().as_ref())
  })
}

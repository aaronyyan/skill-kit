use std::{
  collections::BTreeSet,
  fs,
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::paths::{self, AppPaths, SETTINGS_SCAN_DEPTH};
use crate::types::{ActivityEntry, InstallMode, PersistedSkill, SkillRecord, SkillTargetStatus};

pub fn load_registry_skills(app_paths: &AppPaths) -> Result<Vec<SkillRecord>> {
  let mut items = Vec::new();
  for entry in fs::read_dir(&app_paths.skills_root)? {
    let entry = entry?;
    if !entry.file_type()?.is_dir() {
      continue;
    }
    let skill_json = entry.path().join("skill.json");
    if !skill_json.exists() {
      continue;
    }
    let persisted: PersistedSkill = serde_json::from_str(&fs::read_to_string(&skill_json)?)?;
    items.push(to_skill_record(app_paths, persisted)?);
  }
  items.sort_by(|left, right| left.name.cmp(&right.name));
  Ok(items)
}

pub fn to_skill_record(app_paths: &AppPaths, persisted: PersistedSkill) -> Result<SkillRecord> {
  let skill_dir = app_paths.skills_root.join(&persisted.id);
  let status_targets = [
    crate::types::PlatformKind::Codex,
    crate::types::PlatformKind::Claude,
    crate::types::PlatformKind::Openclaw,
    crate::types::PlatformKind::Hermes,
  ]
  .iter()
  .map(|target| {
    let target_path = paths::target_root(app_paths, target).join(&persisted.name);
    let installed = target_path.exists() || paths::symlink_metadata_exists(&target_path);
    let drift_status = crate::scanning::detect_single_target_status(app_paths, &persisted, target)?;
    let link_type = if installed
      && fs::symlink_metadata(&target_path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false)
    {
      Some(InstallMode::Symlink)
    } else {
      None
    };

    Ok(SkillTargetStatus {
      target: target.clone(),
      installed,
      path: target_path.display().to_string(),
      link_type,
      drift_status,
    })
  })
  .collect::<Result<Vec<_>>>()?;

  let actual_hash = compute_dir_hash(&skill_dir)?;
  Ok(SkillRecord {
    id: persisted.id,
    name: persisted.name,
    category: persisted.category,
    tags: persisted.tags,
    source_path: persisted.source_path,
    description: persisted.description,
    targets: status_targets,
    install_mode: persisted.install_mode,
    managed: persisted.managed,
    hash: actual_hash,
    created_at: persisted.created_at,
    updated_at: persisted.updated_at,
  })
}

pub fn load_persisted_skill(app_paths: &AppPaths, skill_id: &str) -> Result<PersistedSkill> {
  let raw = fs::read_to_string(app_paths.skills_root.join(skill_id).join("skill.json"))?;
  Ok(serde_json::from_str(&raw)?)
}

pub fn write_skill_json(app_paths: &AppPaths, skill: &PersistedSkill) -> Result<()> {
  let directory = app_paths.skills_root.join(&skill.id);
  fs::create_dir_all(&directory)?;
  let json = serde_json::to_string_pretty(skill)?;
  fs::write(directory.join("skill.json"), json)?;
  Ok(())
}

pub fn compute_dir_hash(path: impl AsRef<Path>) -> Result<String> {
  let mut hasher = Sha256::new();
  let mut files: BTreeSet<PathBuf> = BTreeSet::new();

  for entry in WalkDir::new(path.as_ref())
    .max_depth(SETTINGS_SCAN_DEPTH)
    .sort_by_file_name()
  {
    let entry = entry?;
    let relative = entry.path().strip_prefix(path.as_ref())?;
    if relative.as_os_str().is_empty() {
      continue;
    }
    if should_ignore(relative) {
      continue;
    }
    files.insert(relative.to_path_buf());
  }

  for file in files {
    hasher.update(file.to_string_lossy().as_bytes());
    let full_path = path.as_ref().join(&file);
    if full_path.is_file() {
      hasher.update(fs::read(full_path)?);
    }
  }

  Ok(hex::encode(hasher.finalize()))
}

fn should_ignore(path: &Path) -> bool {
  path.components().any(|component| {
    crate::paths::IGNORE_RULES.contains(&component.as_os_str().to_string_lossy().as_ref())
  })
}

pub fn append_log(app_paths: &AppPaths, action: &str) -> Result<()> {
  let timestamp = iso_now();
  let mut file = fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&app_paths.operations_log)?;
  writeln!(file, "{} {}", timestamp, action)?;
  Ok(())
}

pub fn read_activity_log(app_paths: &AppPaths) -> Result<Vec<ActivityEntry>> {
  if !app_paths.operations_log.exists() {
    return Ok(Vec::new());
  }
  let file = fs::File::open(&app_paths.operations_log)?;
  let reader = BufReader::new(file);
  let mut entries = Vec::new();
  for line in reader.lines() {
    let line = line?;
    if let Some((timestamp, action)) = line.split_once(' ') {
      entries.push(ActivityEntry {
        timestamp: timestamp.to_string(),
        action: action.to_string(),
      });
    }
  }
  entries.reverse();
  Ok(entries.into_iter().take(50).collect())
}

pub fn new_skill_id(name: &str) -> String {
  format!("{}-{}", slugify(name), unix_timestamp())
}

fn slugify(name: &str) -> String {
  let slug = name
    .chars()
    .map(|ch| {
      if ch.is_ascii_alphanumeric() {
        ch.to_ascii_lowercase()
      } else {
        '-'
      }
    })
    .collect::<String>();
  slug.trim_matches('-').replace("--", "-")
}

pub fn unix_timestamp() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("time should move forward")
    .as_secs()
}

pub fn iso_now() -> String {
  unix_timestamp().to_string()
}

pub fn time_now() -> String {
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  let secs = now.as_secs();
  let hours = (secs / 3600) % 24;
  let mins = (secs / 60) % 60;
  let secs = secs % 60;
  format!("{:02}:{:02}:{:02}", hours, mins, secs)
}

use std::{
  collections::{BTreeSet, HashMap},
  fs,
};

use anyhow::Result;

use crate::paths::{self, AppPaths};
use crate::registry;
use crate::types::{
  DriftRecord, DriftStatus, PlatformGroup, PlatformKind, PlatformSkillItem, SkillRecord,
  SkillSourceType, SyncState, SyncTargetInfo, TargetSkillEntry, TargetSummary,
};

pub fn scan_all_targets(
  app_paths: &AppPaths,
  registry_skills: &[SkillRecord],
) -> Result<Vec<TargetSummary>> {
  let name_index: HashMap<String, String> = registry_skills
    .iter()
    .map(|skill| (skill.name.clone(), skill.id.clone()))
    .collect();

  [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ]
  .iter()
  .map(|target| {
    let root = paths::target_root(app_paths, target);
    let _ = fs::create_dir_all(&root);
    let writable = paths::is_writable(&root);
    let mut entries = Vec::new();

    if root.exists() {
      for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        let meta = fs::symlink_metadata(&path)?;
        let is_symlink = meta.file_type().is_symlink();
        let has_skill_file = paths::resolve_skill_dir(&path)
          .map(|resolved| resolved.join("SKILL.md").exists())
          .unwrap_or(false);
        let registry_skill_id = name_index.get(&file_name).cloned();
        let managed = is_symlink && registry_skill_id.is_some();
        let status = if managed {
          if let Some(skill_id) = registry_skill_id.clone() {
            let persisted = registry::load_persisted_skill(app_paths, &skill_id)?;
            detect_single_target_status(app_paths, &persisted, target)?
          } else {
            DriftStatus::UnmanagedConflict
          }
        } else {
          DriftStatus::UnmanagedConflict
        };
        entries.push(TargetSkillEntry {
          name: file_name,
          path: path.display().to_string(),
          managed,
          has_skill_file,
          is_symlink,
          registry_skill_id,
          status,
        });
      }
    }

    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(TargetSummary {
      target: target.clone(),
      root_path: root.display().to_string(),
      writable,
      entries,
    })
  })
  .collect()
}

fn scan_skills_directory(
  root: &std::path::Path,
  platform: &PlatformKind,
  target_root_path: &std::path::Path,
  app_paths: &AppPaths,
  registry_skills: &[SkillRecord],
  registry_by_path: &HashMap<String, String>,
  skills: &mut Vec<PlatformSkillItem>,
  seen_skill_keys: &mut BTreeSet<String>,
) -> Result<()> {
  for entry in fs::read_dir(root)? {
    let entry = entry?;
    let entry_path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();

    // Skip hidden files/dirs (.DS_Store, .system, .hub, etc.)
    if name.starts_with('.') {
      continue;
    }

    let is_symlink = fs::symlink_metadata(&entry_path)
      .map(|m| m.file_type().is_symlink())
      .unwrap_or(false);
    let is_dir = entry.file_type()?.is_dir();

    if !is_dir && !is_symlink {
      continue;
    }

    let (skill_dir, source_type) = if is_symlink {
      if let Ok(resolved) = fs::canonicalize(&entry_path) {
        if resolved.is_dir() && resolved.join("SKILL.md").exists() {
          (resolved, SkillSourceType::Symlink)
        } else {
          continue;
        }
      } else {
        continue;
      }
    } else if entry_path.join("SKILL.md").exists() {
      (entry_path.clone(), SkillSourceType::Directory)
    } else {
      continue;
    };

    let normalized = paths::normalize_path(&skill_dir.display().to_string());
    let dedupe_key = normalized.clone();
    if seen_skill_keys.contains(&dedupe_key) {
      continue;
    }
    seen_skill_keys.insert(dedupe_key.clone());
    let skill_id = format!("{}::{}", paths::platform_label(platform), dedupe_key);
    let github_url = crate::parse::extract_github_url(&skill_dir).or_else(|| {
      let skill_json_path = skill_dir.join("skill.json");
      let content = std::fs::read_to_string(&skill_json_path).ok()?;
      let json: serde_json::Value = serde_json::from_str(&content).ok()?;
      json.get("github_url").and_then(|v| v.as_str()).map(|s| s.to_string())
    });
    let description =
      crate::parse::sanitize_description(&skill_dir, crate::parse::extract_description(&skill_dir));
    let managed_registry_id = registry_by_path.get(&normalized).cloned().or_else(|| {
      registry_skills
        .iter()
        .find(|skill| skill.name == name)
        .map(|skill| skill.id.clone())
    });
    let registry_match = managed_registry_id
      .as_ref()
      .and_then(|skill_id| registry_skills.iter().find(|skill| &skill.id == skill_id))
      .or_else(|| registry_skills.iter().find(|skill| skill.name == name));
    let sync_targets = build_sync_targets(
      platform,
      &name,
      target_root_path,
      app_paths,
      registry_skills,
    );

    skills.push(PlatformSkillItem {
      id: skill_id,
      name,
      category: registry_match
        .map(|skill| skill.category.clone())
        .unwrap_or_else(|| "uncategorized".to_string()),
      tags: registry_match
        .map(|skill| skill.tags.clone())
        .unwrap_or_default(),
      description,
      github_url,
      path: skill_dir.display().to_string(),
      install_path: entry_path.display().to_string(),
      root_label: root.display().to_string(),
      source_label: paths::summarize_root_label(app_paths, platform, root),
      platform: platform.clone(),
      source_type,
      managed_registry_id,
      sync_targets,
    });
  }
  Ok(())
}

pub fn scan_platform_groups(
  app_paths: &AppPaths,
  registry_skills: &[SkillRecord],
) -> Result<Vec<PlatformGroup>> {
  let registry_by_path: HashMap<String, String> = registry_skills
    .iter()
    .map(|skill| {
      (
        paths::normalize_existing_path_or_raw(&skill.source_path),
        skill.id.clone(),
      )
    })
    .collect();

  [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ]
  .iter()
  .map(|platform| {
    let roots = paths::platform_roots(app_paths, platform);
    let mut skills = Vec::new();
    let mut seen_skill_keys = BTreeSet::new();
    let target_root_path = paths::target_root(app_paths, platform).clone();

    for root in &roots {
      if !root.exists() {
        continue;
      }
      scan_skills_directory(
        root,
        platform,
        &target_root_path,
        app_paths,
        registry_skills,
        &registry_by_path,
        &mut skills,
        &mut seen_skill_keys,
      )?;
    }

    skills.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(PlatformGroup {
      platform: platform.clone(),
      roots: roots
        .into_iter()
        .map(|root| root.display().to_string())
        .collect(),
      skills,
    })
  })
  .collect()
}

fn build_sync_targets(
  source_platform: &PlatformKind,
  name: &str,
  source_target_root: &std::path::Path,
  app_paths: &AppPaths,
  registry_skills: &[SkillRecord],
) -> Vec<SyncTargetInfo> {
  [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ]
  .iter()
  .map(|platform| {
    let root = paths::target_root(app_paths, platform);
    let candidate = root.join(name);
    let state = if platform == source_platform {
      SyncState::Synced
    } else if !crate::operations::supports_direct_sync(source_platform, platform) {
      SyncState::Unavailable
    } else if candidate.exists() || paths::symlink_metadata_exists(&candidate) {
      let registry_match = registry_skills
        .iter()
        .find(|skill| skill.name == name)
        .and_then(|skill| {
          skill
            .targets
            .iter()
            .find(|target| &target.target == platform)
            .map(|target| target.drift_status.clone())
        });
      match registry_match {
        Some(DriftStatus::UnmanagedConflict) => SyncState::Conflict,
        _ => SyncState::Synced,
      }
    } else if source_target_root.exists() {
      SyncState::Ready
    } else {
      SyncState::Unavailable
    };

    SyncTargetInfo {
      target: platform.clone(),
      state,
      path: Some(candidate.display().to_string()),
    }
  })
  .collect()
}

pub fn detect_single_target_status(
  app_paths: &AppPaths,
  skill: &crate::types::PersistedSkill,
  target: &PlatformKind,
) -> Result<DriftStatus> {
  let target_path = paths::target_root(app_paths, target).join(&skill.name);
  if !paths::symlink_metadata_exists(&target_path) {
    return Ok(DriftStatus::Missing);
  }
  let meta = fs::symlink_metadata(&target_path)?;
  if meta.file_type().is_symlink() {
    let linked = fs::read_link(&target_path)?;
    if !linked.exists() {
      return Ok(DriftStatus::BrokenLink);
    }
    let canonical_target = fs::canonicalize(linked)?;
    let canonical_registry = fs::canonicalize(app_paths.skills_root.join(&skill.id))?;
    if canonical_target != canonical_registry {
      return Ok(DriftStatus::UnmanagedConflict);
    }
    return Ok(DriftStatus::Ok);
  }

  if target_path.join("SKILL.md").exists() {
    let source_hash = registry::compute_dir_hash(app_paths.skills_root.join(&skill.id))?;
    let target_hash = registry::compute_dir_hash(&target_path)?;
    if source_hash != target_hash {
      return Ok(DriftStatus::HashMismatch);
    }
    return Ok(DriftStatus::Ok);
  }

  Ok(DriftStatus::UnmanagedConflict)
}

pub fn detect_drift_inner(
  app_paths: &AppPaths,
  registry_skills: &[SkillRecord],
) -> Result<Vec<DriftRecord>> {
  let mut drift = Vec::new();
  let target_scans = scan_all_targets(app_paths, registry_skills)?;

  for skill in registry_skills {
    for target in &skill.targets {
      if target.drift_status != DriftStatus::Ok {
        drift.push(DriftRecord {
          skill_id: Some(skill.id.clone()),
          skill_name: skill.name.clone(),
          target: target.target.clone(),
          path: target.path.clone(),
          status: target.drift_status.clone(),
          message: format!(
            "Managed install for {} is {:?}",
            skill.name, target.drift_status
          ),
        });
      }
    }
  }

  for target in target_scans {
    for entry in target.entries {
      if entry.status == DriftStatus::UnmanagedConflict {
        drift.push(DriftRecord {
          skill_id: entry.registry_skill_id.clone(),
          skill_name: entry.name,
          target: target.target.clone(),
          path: entry.path,
          status: entry.status,
          message: "Target contains an unmanaged or conflicting directory".to_string(),
        });
      }
    }
  }

  drift.sort_by(|left, right| left.path.cmp(&right.path));
  Ok(drift)
}

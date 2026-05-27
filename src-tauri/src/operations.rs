use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};

use anyhow::{anyhow, Context, Result};
use tauri::{AppHandle, Emitter, Runtime};
use walkdir::WalkDir;

use crate::paths::{self, AppPaths};
use crate::registry;
use crate::types::{
  CreateSkillInput, GitHubScanResult, GitHubSkillPreview, InstallFromGitHubResult, PlatformKind, SkillRecord,
};

pub fn create_skill_inner(
  app_paths: &AppPaths,
  payload: CreateSkillInput,
) -> Result<SkillRecord> {
  let skill_id = registry::new_skill_id(&payload.name);
  let destination = app_paths.skills_root.join(&skill_id);
  fs::create_dir_all(&destination)?;
  let skill_md = destination.join("SKILL.md");
  let scaffold = format!(
    "---\nname: {}\ndescription: {}\n---\n\n# {}\n\nDescribe when this skill should be used and the constraints it should enforce.\n",
    payload.name,
    payload
      .description
      .clone()
      .unwrap_or_else(|| "Managed by SkillHub".to_string()),
    payload.name
  );
  fs::write(&skill_md, scaffold)?;
  let now = registry::iso_now();
  let persisted = crate::types::PersistedSkill {
    id: skill_id.clone(),
    name: payload.name.clone(),
    category: payload
      .category
      .unwrap_or_else(|| "uncategorized".to_string()),
    tags: payload.tags.unwrap_or_default(),
    source_path: destination.display().to_string(),
    description: payload.description.unwrap_or_default(),
    targets: Vec::new(),
    install_mode: crate::types::InstallMode::Symlink,
    managed: true,
    hash: registry::compute_dir_hash(&destination)?,
    created_at: now.clone(),
    updated_at: now,
    github_url: None,
  };
  registry::write_skill_json(app_paths, &persisted)?;
  registry::to_skill_record(app_paths, persisted)
}

pub fn install_skill_inner(
  app_paths: &AppPaths,
  skill_id: &str,
  target: PlatformKind,
) -> Result<SkillRecord> {
  let mut persisted = registry::load_persisted_skill(app_paths, skill_id)?;
  let target_path = paths::target_root(app_paths, &target).join(&persisted.name);
  if target_path.exists() || paths::symlink_metadata_exists(&target_path) {
    let meta = fs::symlink_metadata(&target_path)?;
    if !meta.file_type().is_symlink() {
      return Err(anyhow!("target already contains an unmanaged directory"));
    }
    fs::remove_file(&target_path)?;
  }

  let source = app_paths.skills_root.join(skill_id);
  paths::create_symlink(&source, &target_path)?;
  if !persisted.targets.contains(&target) {
    persisted.targets.push(target);
  }
  persisted.updated_at = registry::iso_now();
  persisted.hash = registry::compute_dir_hash(&source)?;
  registry::write_skill_json(app_paths, &persisted)?;
  registry::to_skill_record(app_paths, persisted)
}

pub fn uninstall_skill_inner(
  app_paths: &AppPaths,
  skill_id: &str,
  target: PlatformKind,
) -> Result<SkillRecord> {
  let mut persisted = registry::load_persisted_skill(app_paths, skill_id)?;
  let target_path = paths::target_root(app_paths, &target).join(&persisted.name);
  if paths::symlink_metadata_exists(&target_path) {
    let meta = fs::symlink_metadata(&target_path)?;
    if meta.file_type().is_symlink() || meta.is_file() {
      fs::remove_file(&target_path)?;
    } else {
      fs::remove_dir_all(&target_path)?;
    }
  }
  persisted.targets.retain(|item| item != &target);
  persisted.updated_at = registry::iso_now();
  registry::write_skill_json(app_paths, &persisted)?;
  registry::to_skill_record(app_paths, persisted)
}

pub fn sync_skill_inner(app_paths: &AppPaths, skill_id: &str) -> Result<SkillRecord> {
  let persisted = registry::load_persisted_skill(app_paths, skill_id)?;
  for target in persisted.targets.clone() {
    let _ = install_skill_inner(app_paths, skill_id, target)?;
  }
  let refreshed = registry::load_persisted_skill(app_paths, skill_id)?;
  registry::to_skill_record(app_paths, refreshed)
}

pub fn sync_all_inner(app_paths: &AppPaths) -> Result<Vec<SkillRecord>> {
  let persisted = registry::load_registry_skills(app_paths)?;
  let mut synced = Vec::new();
  for skill in persisted {
    synced.push(sync_skill_inner(app_paths, &skill.id)?);
  }
  Ok(synced)
}

pub fn delete_skill_inner(app_paths: &AppPaths, skill_id: &str) -> Result<()> {
  let persisted = registry::load_persisted_skill(app_paths, skill_id)?;
  for target in persisted.targets {
    let target_path = paths::target_root(app_paths, &target).join(&persisted.name);
    if paths::symlink_metadata_exists(&target_path) {
      let meta = fs::symlink_metadata(&target_path)?;
      if meta.file_type().is_symlink() || meta.is_file() {
        fs::remove_file(&target_path)?;
      } else {
        fs::remove_dir_all(&target_path)?;
      }
    }
  }
  let registry_path = app_paths.skills_root.join(skill_id);
  if registry_path.exists() {
    fs::remove_dir_all(registry_path)?;
  }
  Ok(())
}

pub fn repair_drift_inner(
  app_paths: &AppPaths,
  skill_id: &str,
  target: PlatformKind,
) -> Result<SkillRecord> {
  install_skill_inner(app_paths, skill_id, target)
}

pub fn supports_direct_sync(
  source_platform: &PlatformKind,
  target_platform: &PlatformKind,
) -> bool {
  !matches!(source_platform, PlatformKind::Claude) && source_platform != target_platform
}

pub fn sync_platform_skill_inner(
  app_paths: &AppPaths,
  source_path: &Path,
  source_platform: PlatformKind,
  target_platform: PlatformKind,
) -> Result<()> {
  if !supports_direct_sync(&source_platform, &target_platform) {
    return Err(anyhow!("当前版本暂不支持这个同步方向"));
  }

  let source_skill_dir =
    paths::resolve_skill_dir(source_path).ok_or_else(|| anyhow!("无效的源路径"))?;
  if !source_skill_dir.join("SKILL.md").exists() {
    return Err(anyhow!("源 skill 缺少 SKILL.md"));
  }

  let name = source_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| anyhow!("无法解析 skill 名称"))?
    .to_string();
  let target_path = paths::target_root(app_paths, &target_platform).join(&name);
  if target_path.exists() || paths::symlink_metadata_exists(&target_path) {
    let current_target =
      paths::resolve_skill_dir(&target_path).unwrap_or_else(|| target_path.clone());
    if paths::normalize_path(&current_target.display().to_string())
      == paths::normalize_path(&source_skill_dir.display().to_string())
    {
      return Ok(());
    }
    return Err(anyhow!("目标平台已存在同名 skill"));
  }
  paths::create_symlink(&source_skill_dir, &target_path)?;
  Ok(())
}

pub fn delete_platform_skill_inner(
  _app_paths: &AppPaths,
  path: &Path,
  _platform: PlatformKind,
  remove_managed_copy: bool,
) -> Result<()> {
  if !paths::symlink_metadata_exists(path) {
    return Err(anyhow!("target path does not exist"));
  }
  let meta = fs::symlink_metadata(path)?;
  if meta.file_type().is_symlink() || meta.is_file() {
    let linked_target = if meta.file_type().is_symlink() {
      fs::read_link(path).ok()
    } else {
      None
    };
    fs::remove_file(path)?;
    if remove_managed_copy {
      if let Some(linked) = linked_target {
        if linked.exists() {
          let _ = fs::remove_dir_all(linked);
        }
      }
    }
  } else {
    fs::remove_dir_all(path)?;
  }
  Ok(())
}

pub fn detect_platform_origin(app_paths: &AppPaths, path: &Path) -> Option<PlatformKind> {
  let normalized = paths::normalize_existing_path_or_raw(&path.display().to_string());
  for platform in [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ] {
    for root in paths::platform_roots(app_paths, &platform) {
      let root_normalized = paths::normalize_existing_path_or_raw(&root.display().to_string());
      if normalized.starts_with(&root_normalized) {
        return Some(platform);
      }
    }
  }
  None
}

pub fn detect_platform_origin_lexical(
  app_paths: &AppPaths,
  raw_path: &str,
) -> Option<PlatformKind> {
  let expanded = paths::expand_tilde(raw_path, &app_paths.home_dir).ok()?;
  let normalized = paths::normalize_lexical_path(&expanded.display().to_string());
  for platform in [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ] {
    for root in paths::platform_roots(app_paths, &platform) {
      let root_normalized = paths::normalize_lexical_path(&root.display().to_string());
      if normalized.starts_with(&root_normalized) {
        return Some(platform);
      }
    }
  }
  None
}

pub fn scan_existing_platforms_for_name(
  app_paths: &AppPaths,
  skill_name: &str,
) -> Vec<PlatformKind> {
  let mut platforms = Vec::new();
  for platform in [
    PlatformKind::Codex,
    PlatformKind::Claude,
    PlatformKind::Openclaw,
    PlatformKind::Hermes,
  ] {
    let candidate = paths::target_root(app_paths, &platform).join(skill_name);
    if candidate.exists() || paths::symlink_metadata_exists(&candidate) {
      platforms.push(platform);
    }
  }
  platforms
}

pub fn install_from_github_inner<R: Runtime>(
  app: &AppHandle<R>,
  app_paths: &AppPaths,
  url: &str,
) -> Result<InstallFromGitHubResult> {
  let (normalized, subpath) =
    crate::parse::parse_github_url(url).ok_or_else(|| anyhow!("请输入有效的 GitHub URL"))?;

  let ts = registry::unix_timestamp();
  let tmp_dir = std::env::temp_dir().join(format!("skillkit-gh-{ts}"));

  let clone_result = (|| -> Result<InstallFromGitHubResult> {
    crate::debug_log!(Some(app), "git clone: {} (subpath: {:?})", normalized, subpath);
    let output = Command::new("git")
      .args([
        "clone",
        "--depth",
        "1",
        &normalized,
        &tmp_dir.display().to_string(),
      ])
      .output()
      .context("无法运行 git，请确认已安装 git")?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      let stdout = String::from_utf8_lossy(&output.stdout);
      crate::debug_log!(Some(app), "git clone failed — stdout: {}, stderr: {}", stdout.trim(), stderr.trim());
      return Err(map_git_error(&stderr));
    }
    crate::debug_log!(Some(app), "git clone 成功，临时目录: {}", tmp_dir.display());

    // If a subpath was specified (e.g. skills/frontend-design), look there first
    let skill_dir = if let Some(ref sub) = subpath {
      let candidate = tmp_dir.join(sub);
      if candidate.join("SKILL.md").exists() {
        crate::debug_log!(Some(app), "子路径找到 SKILL.md: {}", candidate.display());
        candidate
      } else if candidate.exists() {
        // Subpath exists but no SKILL.md directly in it — search inside
        find_skill_md(&candidate, 3)
          .ok_or_else(|| anyhow!("指定路径 {} 中没有找到 SKILL.md 文件。", sub))?
      } else {
        crate::debug_log!(Some(app), "子路径不存在: {}, 回退到全局搜索", candidate.display());
        find_skill_md(&tmp_dir, 3)
          .ok_or_else(|| anyhow!("仓库中没有找到 SKILL.md 文件。"))?
      }
    } else {
      find_skill_md(&tmp_dir, 3)
        .ok_or_else(|| anyhow!("仓库中没有找到 SKILL.md 文件。"))?
    };
    crate::debug_log!(Some(app), "找到 SKILL.md: {}", skill_dir.display());

    let name = crate::parse::extract_name(&skill_dir)
      .or_else(|| {
        // Fall back to the last segment of the subpath, or the repo name
        subpath
          .as_ref()
          .and_then(|s| s.split('/').last().map(|v| v.to_string()))
          .or_else(|| {
            normalized
              .rsplit('/')
              .next()
              .map(|s| s.trim_end_matches(".git").to_string())
          })
      })
      .unwrap_or_else(|| "unnamed-skill".to_string());
    crate::debug_log!(Some(app), "提取到 name: {}", name);

    let description = crate::parse::extract_description(&skill_dir);

    let skill_record = create_skill_inner(
      app_paths,
      CreateSkillInput {
        name,
        category: None,
        description: Some(description),
        tags: None,
      },
    )?;
    crate::debug_log!(Some(app), "创建 registry 条目: {}", skill_record.id);

    let registry_dir = app_paths.skills_root.join(&skill_record.id);
    paths::copy_dir(&skill_dir, &registry_dir)?;
    crate::debug_log!(Some(app), "复制内容到: {}", registry_dir.display());

    crate::debug_log!(Some(app), "重新计算 hash...");
    let mut persisted = registry::load_persisted_skill(app_paths, &skill_record.id)?;
    persisted.github_url = Some(normalized.clone());
    persisted.hash = registry::compute_dir_hash(&registry_dir)?;
    registry::write_skill_json(app_paths, &persisted)?;
    crate::debug_log!(Some(app), "hash 更新完成");

    // Copy to all platforms (direct copy, not symlink)
    let mut installed_platforms = Vec::new();
    for (platform, root) in &app_paths.target_roots {
      let platform_dir = root.join(&persisted.name);
      match paths::copy_dir(&registry_dir, &platform_dir) {
        Ok(_) => {
          crate::debug_log!(Some(app), "安装到 {:?} 成功: {}", platform, platform_dir.display());
          installed_platforms.push(platform.clone());
          if !persisted.targets.contains(platform) {
            persisted.targets.push(platform.clone());
          }
        }
        Err(e) => {
          log::warn!("安装到 {:?} 失败: {}", platform, e);
          crate::debug_log!(Some(app), "安装到 {:?} 失败: {}", platform, e);
        }
      }
    }
    registry::write_skill_json(app_paths, &persisted)?;

    crate::debug_log!(Some(app), "安装完成，skill: {}, platforms: {:?}", persisted.name, installed_platforms);
    let skill = registry::to_skill_record(app_paths, registry::load_persisted_skill(app_paths, &skill_record.id)?)?;
    Ok(InstallFromGitHubResult {
      skill,
      installed_platforms,
    })
  })();

  // Cleanup temp dir regardless of success/failure
  let _ = fs::remove_dir_all(&tmp_dir);

  clone_result
}

fn find_skill_md(root: &Path, max_depth: usize) -> Option<PathBuf> {
  let mut best: Option<(usize, PathBuf)> = None;
  for entry in WalkDir::new(root).max_depth(max_depth) {
    let entry = entry.ok()?;
    if entry
      .file_name()
      .to_string_lossy()
      .eq_ignore_ascii_case("SKILL.md")
    {
      let depth = entry.path().components().count() - root.components().count();
      if best.as_ref().map_or(true, |(d, _)| depth < *d) {
        best = Some((depth, entry.path().to_path_buf()));
      }
    }
  }
  best.map(|(_, path)| path.parent().unwrap_or(root).to_path_buf())
}

fn find_all_skill_md(root: &Path, max_depth: usize) -> Vec<PathBuf> {
  let mut results = Vec::new();
  for entry in WalkDir::new(root).max_depth(max_depth) {
    let entry = match entry {
      Ok(e) => e,
      Err(_) => continue,
    };
    if entry
      .file_name()
      .to_string_lossy()
      .eq_ignore_ascii_case("SKILL.md")
    {
      if let Some(parent) = entry.path().parent() {
        results.push(parent.to_path_buf());
      }
    }
  }
  results
}

fn clone_repo(url: &str, tmp_dir: &Path) -> Result<()> {
  let output = Command::new("git")
    .args([
      "clone",
      "--depth",
      "1",
      url,
      &tmp_dir.display().to_string(),
    ])
    .output()
    .context("无法运行 git，请确认已安装 git")?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(map_git_error(&stderr));
  }
  Ok(())
}

pub fn scan_github_repo_inner<R: Runtime>(
  app: &AppHandle<R>,
  url: &str,
) -> Result<GitHubScanResult> {
  let (normalized, url_subpath) =
    crate::parse::parse_github_url(url).ok_or_else(|| anyhow!("请输入有效的 GitHub URL"))?;

  let ts = registry::unix_timestamp();
  let tmp_dir = std::env::temp_dir().join(format!("skillkit-scan-{ts}"));

  let result = (|| -> Result<GitHubScanResult> {
    crate::debug_log!(Some(app), "scan: git clone: {} (subpath: {:?})", normalized, url_subpath);
    clone_repo(&normalized, &tmp_dir)?;
    crate::debug_log!(Some(app), "scan: clone 成功");

    let skill_dirs = find_all_skill_md(&tmp_dir, 4);
    crate::debug_log!(Some(app), "scan: 找到 {} 个 SKILL.md", skill_dirs.len());

    let mut previews = Vec::new();
    for skill_dir in &skill_dirs {
      let name = crate::parse::extract_name(skill_dir)
        .unwrap_or_else(|| {
          skill_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed")
            .to_string()
        });
      let description = crate::parse::extract_description(skill_dir);
      let subpath = skill_dir
        .strip_prefix(&tmp_dir)
        .unwrap_or(skill_dir)
        .to_string_lossy()
        .to_string();

      previews.push(GitHubSkillPreview {
        name,
        description,
        subpath,
      });
    }

    Ok(GitHubScanResult {
      repo_url: normalized,
      subpath: url_subpath,
      skills: previews,
    })
  })();

  let _ = fs::remove_dir_all(&tmp_dir);
  result
}

pub fn install_multiple_from_github_inner<R: Runtime>(
  app: &AppHandle<R>,
  app_paths: &AppPaths,
  url: &str,
  subpaths: &[String],
) -> Result<Vec<InstallFromGitHubResult>> {
  let (normalized, _subpath) =
    crate::parse::parse_github_url(url).ok_or_else(|| anyhow!("请输入有效的 GitHub URL"))?;

  let ts = registry::unix_timestamp();
  let tmp_dir = std::env::temp_dir().join(format!("skillkit-gh-{ts}"));

  let result = (|| -> Result<Vec<InstallFromGitHubResult>> {
    crate::debug_log!(Some(app), "multi-install: git clone: {}", normalized);
    clone_repo(&normalized, &tmp_dir)?;
    crate::debug_log!(Some(app), "multi-install: clone 成功");

    let mut results = Vec::new();
    for subpath in subpaths {
      let skill_dir = tmp_dir.join(subpath);
      if !skill_dir.join("SKILL.md").exists() {
        crate::debug_log!(Some(app), "multi-install: 跳过 {} (无 SKILL.md)", subpath);
        continue;
      }

      let name = crate::parse::extract_name(&skill_dir)
        .or_else(|| {
          subpath.split('/').last().map(|s| s.to_string())
        })
        .unwrap_or_else(|| "unnamed-skill".to_string());
      let description = crate::parse::extract_description(&skill_dir);

      let skill_record = create_skill_inner(
        app_paths,
        CreateSkillInput {
          name,
          category: None,
          description: Some(description),
          tags: None,
        },
      )?;

      let registry_dir = app_paths.skills_root.join(&skill_record.id);
      paths::copy_dir(&skill_dir, &registry_dir)?;

      let mut persisted = registry::load_persisted_skill(app_paths, &skill_record.id)?;
      persisted.github_url = Some(normalized.clone());
      persisted.hash = registry::compute_dir_hash(&registry_dir)?;
      registry::write_skill_json(app_paths, &persisted)?;

      let mut installed_platforms = Vec::new();
      for (platform, root) in &app_paths.target_roots {
        let platform_dir = root.join(&persisted.name);
        match paths::copy_dir(&registry_dir, &platform_dir) {
          Ok(_) => {
            installed_platforms.push(platform.clone());
            if !persisted.targets.contains(platform) {
              persisted.targets.push(platform.clone());
            }
          }
          Err(e) => {
            log::warn!("安装到 {:?} 失败: {}", platform, e);
          }
        }
      }
      registry::write_skill_json(app_paths, &persisted)?;

      let skill = registry::to_skill_record(app_paths, registry::load_persisted_skill(app_paths, &skill_record.id)?)?;
      results.push(InstallFromGitHubResult {
        skill,
        installed_platforms,
      });
    }

    Ok(results)
  })();

  let _ = fs::remove_dir_all(&tmp_dir);
  result
}

fn map_git_error(stderr: &str) -> anyhow::Error {
  let lower = stderr.to_lowercase();
  if lower.contains("could not resolve host") || lower.contains("network is unreachable") {
    anyhow!(
      "网络连接失败，请检查网络后重试。\n\n原始信息: {}",
      stderr.trim()
    )
  } else if lower.contains("repository not found") || lower.contains("does not exist") {
    anyhow!(
      "仓库不存在，请确认 URL 正确且仓库是公开的。\n\n原始信息: {}",
      stderr.trim()
    )
  } else if lower.contains("permission denied") || lower.contains("authentication") {
    anyhow!(
      "权限不足。私有仓库需要配置 SSH 密钥或 git 凭据。\n\n原始信息: {}",
      stderr.trim()
    )
  } else {
    anyhow!("git 克隆失败: {}", stderr.trim())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::registry::unix_timestamp;

  fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("{}-{}", prefix, unix_timestamp()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir should be created");
    dir
  }

  #[test]
  fn codex_to_claude_platform_sync_creates_symlink() {
    let base = temp_dir("skillhub-platform-sync");
    let registry = base.join("registry");
    let codex = base.join("codex");
    let claude = base.join("claude");
    let codex_skill = codex.join("sample-skill");
    fs::create_dir_all(&codex_skill).expect("codex skill dir");
    fs::write(codex_skill.join("SKILL.md"), "# Sample").expect("skill file");

    let app_paths = AppPaths::from_roots(registry, codex.clone(), claude.clone()).expect("paths");
    sync_platform_skill_inner(
      &app_paths,
      &codex_skill,
      PlatformKind::Codex,
      PlatformKind::Claude,
    )
    .expect("platform sync should succeed");

    let target = claude.join("sample-skill");
    assert!(target.exists());
    assert!(fs::symlink_metadata(&target)
      .expect("symlink metadata")
      .file_type()
      .is_symlink());
  }

}

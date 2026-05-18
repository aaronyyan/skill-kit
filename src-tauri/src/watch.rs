use std::{
  path::PathBuf,
  sync::mpsc,
  thread,
  time::Duration,
};

use anyhow::Result;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::paths::platform_from_path;
use crate::types::SkillChangeNotice;

pub fn watch_skill_directories(app_handle: &AppHandle) -> Result<RecommendedWatcher> {
  let Some(home) = dirs_next::home_dir() else {
    anyhow::bail!("home directory not found");
  };

  let skill_dirs: Vec<PathBuf> = vec![
    home.join(".claude/skills"),
    home.join(".codex/skills"),
    home.join(".openclaw/skills"),
    home.join(".hermes/skills"),
  ];

  let (tx, rx) = mpsc::channel::<Event>();

  let mut watcher = RecommendedWatcher::new(
    move |res: notify::Result<Event>| {
      if let Ok(event) = res {
        let _ = tx.send(event);
      }
    },
    notify::Config::default(),
  )?;

  for dir in &skill_dirs {
    watcher
      .watch(dir, RecursiveMode::Recursive)
      .unwrap_or_else(|e| log::warn!("Failed to watch {}: {}", dir.display(), e));
  }

  let app_handle = app_handle.clone();
  thread::spawn(move || {
    let mut pending: Vec<SkillChangeNotice> = Vec::new();

    loop {
      match rx.recv_timeout(Duration::from_millis(500)) {
        Ok(event) => {
          for path in &event.paths {
            let Some(platform) = platform_from_path(path) else {
              continue;
            };
            let platform_str = format!("{platform:?}").to_lowercase();
            let action = match event.kind {
              notify::EventKind::Create(_) => "added".to_string(),
              notify::EventKind::Remove(_) => "removed".to_string(),
              _ => "changed".to_string(),
            };
            // Deduplicate: skip if same platform+action already pending
            if !pending
              .iter()
              .any(|p| p.platform == platform_str && p.action == action)
            {
              pending.push(SkillChangeNotice {
                platform: platform_str,
                action,
              });
            }
          }
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
          if !pending.is_empty() {
            let notices: Vec<SkillChangeNotice> = pending.drain(..).collect();
            for notice in &notices {
              log::info!("Skill {} on {}", notice.action, notice.platform);
            }
            let _ = app_handle.emit("skill-changed", &notices);
          }
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => break,
      }
    }
  });

  Ok(watcher)
}

use std::fs;
use std::path::Path;

pub fn extract_description(skill_dir: &Path) -> String {
  let skill_file = skill_dir.join("SKILL.md");
  if let Ok(content) = fs::read_to_string(&skill_file) {
    let lines: Vec<&str> = content.lines().collect();
    let mut index = 0;

    while index < lines.len() {
      let trimmed = lines[index].trim();
      if let Some(value) = trimmed.strip_prefix("description:") {
        let inline_value = value.trim().trim_matches('"').trim_matches('\'');
        let is_block_scalar = inline_value == "|" || inline_value == ">" || inline_value.is_empty();

        if is_block_scalar {
          let mut description_lines = Vec::new();
          let mut offset = index + 1;
          while offset < lines.len() {
            let raw_line = lines[offset];
            if raw_line.trim().is_empty() {
              if !description_lines.is_empty() {
                break;
              }
              offset += 1;
              continue;
            }

            if !raw_line.starts_with(' ') && !raw_line.starts_with('\t') {
              break;
            }

            description_lines.push(raw_line.trim().to_string());
            offset += 1;
          }

          let description = description_lines.join(" ").trim().to_string();
          if !description.is_empty() {
            return description;
          }
        } else {
          return inline_value.to_string();
        }
      }

      index += 1;
    }

    for line in content.lines() {
      let trimmed = line.trim();
      if trimmed.is_empty() || trimmed.starts_with('#') || trimmed == "---" {
        continue;
      }
      return trimmed.to_string();
    }
  }
  String::new()
}

pub fn extract_name(skill_dir: &Path) -> Option<String> {
  let skill_file = skill_dir.join("SKILL.md");
  let content = fs::read_to_string(skill_file).ok()?;
  for line in content.lines() {
    let trimmed = line.trim();
    if let Some(value) = trimmed.strip_prefix("name:") {
      return Some(value.trim().trim_matches('"').trim_matches('\'').to_string());
    }
  }
  None
}

pub fn sanitize_description(skill_dir: &Path, description: String) -> String {
  let trimmed = description.trim();
  if !trimmed.is_empty() && !matches!(trimmed, "|" | ">" | "|-" | ">-") {
    return trimmed.to_string();
  }

  extract_body_summary(skill_dir).unwrap_or_default()
}

fn extract_body_summary(skill_dir: &Path) -> Option<String> {
  let skill_file = skill_dir.join("SKILL.md");
  let content = fs::read_to_string(skill_file).ok()?;
  let mut in_frontmatter = false;
  let mut frontmatter_closed = false;
  let mut in_comment = false;
  let mut summary_lines = Vec::new();

  for (index, raw_line) in content.lines().enumerate() {
    let trimmed = raw_line.trim();

    if index == 0 && trimmed == "---" {
      in_frontmatter = true;
      continue;
    }

    if in_frontmatter {
      if trimmed == "---" {
        in_frontmatter = false;
        frontmatter_closed = true;
      }
      continue;
    }

    if trimmed.starts_with("<!--") {
      in_comment = true;
    }
    if in_comment {
      if trimmed.ends_with("-->") {
        in_comment = false;
      }
      continue;
    }

    if !frontmatter_closed && trimmed == "---" {
      continue;
    }

    if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("```") {
      if !summary_lines.is_empty() {
        break;
      }
      continue;
    }

    let normalized = trimmed
      .trim_start_matches('>')
      .trim_start_matches('-')
      .trim()
      .to_string();

    if normalized.is_empty() {
      if !summary_lines.is_empty() {
        break;
      }
      continue;
    }

    summary_lines.push(normalized);
    if summary_lines.len() >= 3 {
      break;
    }
  }

  let summary = summary_lines.join(" ").trim().to_string();
  if summary.is_empty() {
    None
  } else {
    Some(summary)
  }
}

pub fn extract_github_url(skill_dir: &Path) -> Option<String> {
  let git_config = skill_dir.join(".git").join("config");
  if let Ok(content) = fs::read_to_string(git_config) {
    if let Some(url) = first_github_url(&content) {
      return Some(url);
    }
  }

  for filename in ["SKILL.md", "README.md"] {
    let candidate = skill_dir.join(filename);
    if let Ok(content) = fs::read_to_string(candidate) {
      if let Some(url) = first_github_url(&content) {
        return Some(url);
      }
    }
  }

  None
}

fn first_github_url(content: &str) -> Option<String> {
  content
    .split_whitespace()
    .find_map(normalize_github_repo_url)
}

pub fn normalize_github_repo_url(token: &str) -> Option<String> {
  let trimmed = token.trim_matches(|ch: char| ['(', ')', '[', ']', '{', '}', '"', '\''].contains(&ch));

  let raw_path = if let Some(value) = trimmed.strip_prefix("git@github.com:") {
    value
  } else if let Some(value) = trimmed.strip_prefix("https://github.com/") {
    value
  } else if let Some(value) = trimmed.strip_prefix("http://github.com/") {
    value
  } else if let Some(value) = trimmed.strip_prefix("github.com/") {
    value
  } else {
    return None;
  };

  let normalized = raw_path
    .trim_end_matches(".git")
    .trim_end_matches(|ch: char| ['/', '.', ',', ':', ';'].contains(&ch));

  let repo_path = normalized
    .split(['#', '?'])
    .next()
    .unwrap_or("")
    .trim_matches(|ch: char| ['/', '.', ',', ':', ';'].contains(&ch));

  let mut segments = repo_path.split('/').filter(|segment| !segment.is_empty());
  let owner = segments.next()?;
  let repo = segments.next()?;

  if owner.starts_with('.') || repo.starts_with('.') {
    return None;
  }

  Some(format!("https://github.com/{owner}/{repo}"))
}

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="SkillKit Icon">
</p>

<h1 align="center">SkillKit</h1>

<p align="center">
  <em>A cross-platform desktop tool that unifies Skills management across AI coding platforms. Supports macOS, Windows, and Linux.</em>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | English
</p>

![2560X1960/image.png](https://backup.fukit.cn/autoupload/en/Hs4yOe0DD5blOyn6kcESAbMpbbjFj-XZeOSs8VxRDiGyl5f0KlZfm6UsKj-HyTuv/20260527/eBGv/2560X1960/image.png)

## ✨ Features

- **Unified View**: Auto-scan and display Skills from Claude Code, OpenAI Codex, OpenClaw, Hermes and more
- **Real-time Sync**: Built-in file system watcher, changes refresh automatically
- **Cross-platform Sync**: One-click Skill sync and migration across AI platforms
- **GitHub Install**: Install Skills directly via GitHub URL, with batch install support
- **Local Registry**: Persistent management, zero cloud dependency

## 📥 Download

Download the installer for your platform from [Releases](https://github.com/aaronyyan/skill-kit/releases/latest):

| Platform | File |
|:---|:---|
| macOS (Apple Silicon) | `SkillKit_aarch64.dmg` |
| macOS (Intel) | `SkillKit_x64.dmg` |
| Windows | `SkillKit_x64-setup.exe` |
| Linux (Debian/Ubuntu) | `SkillKit_amd64.deb` |
| Linux (AppImage) | `SkillKit_amd64.AppImage` |
| Linux (Fedora/RHEL) | `SkillKit_x86_64.rpm` |

## 🔧 Build from Source

Make sure you have Node.js and Rust installed.

```bash
git clone https://github.com/aaronyyan/skill-kit.git
cd skill-kit
npm install
npm run tauri dev
```

Build for production: `npm run tauri build`

## 🛠 Tech Stack

| Module | Technology |
|:---|:---|
| Framework | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Tailwind CSS |
| Animation | Framer Motion |
| File Watcher | notify (Rust) |

## 🌐 Supported AI Platforms

| Platform | Skill Directory |
|:---|:---|
| Claude Code | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| OpenClaw | `~/.openclaw/skills` |
| Hermes | `~/.hermes/skills` |

---

<p align="center">
  <b>Star this repo if you find it useful!</b>
</p>

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="SkillKit Icon">
</p>

<h1 align="center">SkillKit</h1>

<p align="center">
  <em>一款跨平台桌面工具，通过聚合视图统一管理分布在不同 AI 编码平台中的 Skills。支持 macOS、Windows 和 Linux。</em>
</p>

<p align="center">
  中文 | <a href="README.md">English</a>
</p>

## ✨ 核心功能

- **一键聚合展示**：自动扫描并汇总 Claude Code、OpenAI Codex、OpenClaw、Hermes 等主流平台的 Skills
- **实时同步感知**：内置文件系统监听，本地变更自动刷新，无需手动干预
- **无缝跨平台同步**：支持跨 AI 平台 Skill 一键同步与迁移
- **GitHub 一键安装**：通过 GitHub URL 直接安装 Skill，支持批量安装
- **本地 Registry**：持久化管理，零云端依赖

## 📥 下载安装

前往 [Releases](https://github.com/aaronyyan/skill-kit/releases/latest) 下载对应平台的安装包：

| 平台 | 文件 |
|:---|:---|
| macOS (Apple Silicon) | `SkillKit_aarch64.dmg` |
| macOS (Intel) | `SkillKit_x64.dmg` |
| Windows | `SkillKit_x64-setup.exe` |
| Linux (Debian/Ubuntu) | `SkillKit_amd64.deb` |
| Linux (AppImage) | `SkillKit_amd64.AppImage` |
| Linux (Fedora/RHEL) | `SkillKit_x86_64.rpm` |

## 🔧 从源码构建

请确保已安装 Node.js 与 Rust。

```bash
git clone https://github.com/aaronyyan/skill-kit.git
cd skill-kit
npm install
npm run tauri dev
```

构建生产版本：`npm run tauri build`

## 🛠 技术栈

| 模块 | 技术选型 |
|:---|:---|
| 框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Tailwind CSS |
| 动效 | Framer Motion |
| 文件监听 | notify (Rust) |

## 🌐 支持的 AI 平台

| 平台 | Skill 目录 |
|:---|:---|
| Claude Code | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| OpenClaw | `~/.openclaw/skills` |
| Hermes | `~/.hermes/skills` |

---

<p align="center">
  <b>Star this repo if you find it useful!</b>
</p>

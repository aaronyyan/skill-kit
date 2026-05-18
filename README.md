**SkillKit**

SkillKit 是一款专为开发者打造的 macOS 桌面工具，旨在通过聚合视图统一管理分布在不同 AI 编码平台（Claude Code、Codex、OpenClaw、Hermes）中的 Skills。

### ✨ 核心功能

- 四大平台 Skills 一键聚合扫描与展示
- 文件系统实时监听，变更自动刷新
- 跨平台 Skill 一键同步与迁移
- GitHub URL 一键安装 Skill
- 本地 Registry 持久化管理

### 📥 快速安装

Bash

```bash
git clone https://github.com/aaronyyan/skill-kit.git
cd skill-kit
npm install
npm run tauri dev
```

构建生产版本请执行 npm run tauri build。

------

### 🛠 技术栈

- **框架**：Tauri v2 (Rust)
- **前端**：React 19 + TypeScript + Tailwind CSS
- **动效**：Framer Motion
- **文件监听**：notify (Rust)

------

### 🌐 支持平台

| 平台        | Skill 目录         |
| ----------- | ------------------ |
| Claude Code | ~/.claude/skills   |
| Codex       | ~/.codex/skills    |
| OpenClaw    | ~/.openclaw/skills |
| Hermes      | ~/.hermes/skills   |

------

**SkillKit** —— 让你的 AI Skills 实现真正的跨平台统一管理。

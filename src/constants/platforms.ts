// ── 平台与分类常量 ────────────────────────────────────────────────
// PLATFORM_TABS: 平台 Tab 配置（图标、颜色）
// CATEGORY_ICONS: 分类图标映射
// TAG_COLOR_MAP: 分类标签颜色
// SKILL_CATEGORY_MAP: skill 名称 → 分类的硬编码映射（兜底用）

import { Boxes, Brain, Brush, Code2, FileText, LayoutTemplate, Package, SearchCheck, Settings2, Sparkles, Bot } from 'lucide-react'
import type { PlatformKind } from '../types'
import openaiIcon from '../assets/brands/openai.png'
import claudeIcon from '../assets/brands/claude.ico'
import hermesIcon from '../assets/brands/hermes-x.jpg'

export type PlatformTab = {
  key: PlatformKind
  label: string
  icon: string
  iconAlt: string
  iconType?: 'image' | 'emoji'
  accent: string
  softAccent: string
}

export const PLATFORM_TABS: PlatformTab[] = [
  {
    key: 'codex',
    label: 'Codex',
    icon: openaiIcon,
    iconAlt: 'OpenAI',
    iconType: 'image',
    accent: '#38b86b',
    softAccent: 'rgba(56, 184, 107, 0.14)',
  },
  {
    key: 'claude',
    label: 'Claude Code',
    icon: claudeIcon,
    iconAlt: 'Claude Code',
    iconType: 'image',
    accent: '#d08a41',
    softAccent: 'rgba(208, 138, 65, 0.14)',
  },
  {
    key: 'openclaw',
    label: 'OpenClaw',
    icon: '🦞',
    iconAlt: 'OpenClaw',
    iconType: 'emoji',
    accent: '#49a2a0',
    softAccent: 'rgba(73, 162, 160, 0.14)',
  },
  {
    key: 'hermes',
    label: 'Hermes',
    icon: hermesIcon,
    iconAlt: 'Hermes',
    iconType: 'image',
    accent: '#8b7cff',
    softAccent: 'rgba(139, 124, 255, 0.14)',
  },
]

export const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Boxes,
  design: Brush,
  media: Sparkles,
  uncategorized: Bot,
  analysis: Brain,
  backend: Code2,
  docs: FileText,
  engineering: Settings2,
  frontend: LayoutTemplate,
  install: Package,
  research: SearchCheck,
  testing: Boxes,
}

export const TAG_COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  design: { border: 'rgba(236,72,153,0.3)', bg: 'rgba(236,72,153,0.1)', text: '#f472b6' },
  frontend: { border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.1)', text: '#60a5fa' },
  backend: { border: 'rgba(168,85,247,0.3)', bg: 'rgba(168,85,247,0.1)', text: '#c084fc' },
  media: { border: 'rgba(249,115,22,0.3)', bg: 'rgba(249,115,22,0.1)', text: '#fb923c' },
  docs: { border: 'rgba(34,197,94,0.3)', bg: 'rgba(34,197,94,0.1)', text: '#4ade80' },
  automation: { border: 'rgba(234,179,8,0.3)', bg: 'rgba(234,179,8,0.1)', text: '#facc15' },
  testing: { border: 'rgba(20,184,166,0.3)', bg: 'rgba(20,184,166,0.1)', text: '#2dd4bf' },
  analysis: { border: 'rgba(99,102,241,0.3)', bg: 'rgba(99,102,241,0.1)', text: '#818cf8' },
  research: { border: 'rgba(14,165,233,0.3)', bg: 'rgba(14,165,233,0.1)', text: '#38bdf8' },
  productivity: { border: 'rgba(244,114,182,0.3)', bg: 'rgba(244,114,182,0.1)', text: '#f9a8d4' },
  system: { border: 'rgba(148,163,184,0.3)', bg: 'rgba(148,163,184,0.1)', text: '#94a3b8' },
  engineering: { border: 'rgba(20,184,166,0.3)', bg: 'rgba(20,184,166,0.1)', text: '#2dd4bf' },
  install: { border: 'rgba(34,197,94,0.3)', bg: 'rgba(34,197,94,0.1)', text: '#4ade80' },
  memory: { border: 'rgba(168,85,247,0.3)', bg: 'rgba(168,85,247,0.1)', text: '#c084fc' },
}

export const SKILL_CATEGORY_MAP: Record<string, string> = {
  // frontend
  'composition-patterns': 'frontend',
  'react-best-practices': 'frontend',
  'react-native-skills': 'frontend',
  'react-view-transitions': 'frontend',
  'swiftui-expert-skill': 'frontend',
  'swiftui-theme-refactor-cli-validation': 'frontend',
  'swiftui-ux-settings-audit': 'frontend',
  'frontend-design': 'frontend',
  'frontend-skill': 'frontend',
  'ui-ux-pro-max': 'frontend',
  'apple': 'frontend',

  // design
  'figma-use': 'design',
  'gstack-design-consultation': 'design',
  'gstack-design-review': 'design',
  'gstack-plan-design-review': 'design',
  'web-design-guidelines': 'design',

  // media
  'baoyu-article-illustrator': 'media',
  'baoyu-comic': 'media',
  'baoyu-compress-image': 'media',
  'baoyu-cover-image': 'media',
  'baoyu-danger-gemini-web': 'media',
  'baoyu-diagram': 'media',
  'baoyu-image-cards': 'media',
  'baoyu-image-gen': 'media',
  'baoyu-imagine': 'media',
  'baoyu-infographic': 'media',
  'baoyu-slide-deck': 'media',
  'baoyu-xhs-images': 'media',
  'excalidraw-diagram': 'media',
  'rehdasu-gpt-image-2': 'media',
  'creative': 'media',
  'diagramming': 'media',
  'gifs': 'media',

  // docs
  'baoyu-danger-x-to-markdown': 'docs',
  'baoyu-format-markdown': 'docs',
  'baoyu-markdown-to-html': 'docs',
  'baoyu-translate': 'docs',
  'baoyu-url-to-markdown': 'docs',
  'baoyu-youtube-transcript': 'docs',
  'baoyu-post-to-wechat': 'docs',
  'baoyu-post-to-weibo': 'docs',
  'baoyu-post-to-x': 'docs',
  'doc-specialist': 'docs',
  'gstack-document-release': 'docs',
  'note-taking': 'docs',

  // testing
  'agent-browser': 'testing',
  'gstack-browse': 'testing',
  'gstack-qa': 'testing',
  'gstack-qa-only': 'testing',
  'gstack-setup-browser-cookies': 'testing',
  'pua': 'testing',
  'dogfood': 'testing',
  'red-teaming': 'testing',

  // analysis
  'code-analyst': 'analysis',
  'frontend-quickstart': 'analysis',
  'gstack-investigate': 'analysis',
  'karpathy-guidelines': 'analysis',
  'data-science': 'analysis',

  // engineering
  'agent-orchestrator': 'engineering',
  'build-iphone-apps': 'engineering',
  'build-macos-apps': 'engineering',
  'debug-specialist': 'engineering',
  'gstack': 'engineering',
  'gstack-careful': 'engineering',
  'gstack-freeze': 'engineering',
  'gstack-guard': 'engineering',
  'gstack-office-hours': 'engineering',
  'gstack-plan-ceo-review': 'engineering',
  'gstack-plan-eng-review': 'engineering',
  'gstack-retro': 'engineering',
  'gstack-review': 'engineering',
  'gstack-ship': 'engineering',
  'gstack-unfreeze': 'engineering',
  'local-install-triage': 'engineering',
  'planning-with-files': 'engineering',
  'pua-debugging': 'engineering',
  'squad': 'engineering',
  'github': 'engineering',
  'software-development': 'engineering',

  // memory
  'context-hub-docs': 'memory',
  'memory-lancedb-pro': 'memory',

  // system
  'deploy-to-vercel': 'system',
  'vercel-cli-with-tokens': 'system',
  'xcodebuildmcp': 'system',
  'devops': 'system',
  'inference-sh': 'system',
  'mcp': 'system',
  'openclaw-imports': 'system',

  // automation
  'autonomous-ai-agents': 'automation',
  'email': 'automation',
  'feeds': 'automation',
  'gaming': 'automation',
  'leisure': 'automation',
  'media': 'automation',
  'productivity': 'automation',
  'research': 'automation',
  'smart-home': 'automation',
  'social-media': 'automation',
  'domain': 'automation',

  // install
  'gstack-upgrade': 'install',
}

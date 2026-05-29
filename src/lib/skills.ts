// ── Skill 工具函数 ────────────────────────────────────────────────
// 分类推断、标签映射、平台名称等辅助逻辑

import type { PlatformKind, PlatformSkillItem } from '../types'
import type { LanguagePreference } from '../constants/i18n'
import { CATEGORY_LABELS } from '../constants/i18n'
import { PLATFORM_TABS, SKILL_CATEGORY_MAP } from '../constants/platforms'

/** 标准化分类名：转小写，空值返回 'uncategorized' */
export function normalizeCategory(value: string | undefined) {
  if (!value) {
    return 'uncategorized'
  }
  return value.trim().toLowerCase() || 'uncategorized'
}

/** 获取分类的本地化显示名 */
export function categoryLabel(value: string | undefined, language: LanguagePreference = 'zh') {
  const normalized = normalizeCategory(value)
  return CATEGORY_LABELS[language][normalized] ?? value ?? CATEGORY_LABELS[language].uncategorized
}

/** 补全 skill 的默认值（tags、syncTargets、sourceLabel 等） */
export function normalizeSkill(skill: PlatformSkillItem, defaultSourceLabel: string): PlatformSkillItem {
  return {
    ...skill,
    category: skill.category || 'uncategorized',
    tags: Array.isArray(skill.tags) ? skill.tags : [],
    syncTargets: Array.isArray(skill.syncTargets) ? skill.syncTargets : [],
    sourceLabel: skill.sourceLabel || defaultSourceLabel,
    installPath: skill.installPath || skill.path,
  }
}

/** 获取平台的显示名称（如 'codex' → 'Codex'） */
export function platformLabel(platform: PlatformKind) {
  const current = PLATFORM_TABS.find((tab) => tab.key === platform)
  return current?.label ?? platform
}

const SOURCE_LABELS: Record<string, Record<string, string>> = {
  codex: { zh: 'Codex', en: 'Codex' },
  'claude-code': { zh: 'Claude Code', en: 'Claude Code' },
  skillkit: { zh: 'SkillKit', en: 'SkillKit' },
  local: { zh: '本地', en: 'Local' },
}

/** 获取来源的本地化显示名（codex → 'Codex'，claude-code → 'Claude Code'） */
export function sourceLabel(source: string, language: string = 'zh') {
  return SOURCE_LABELS[source]?.[language] ?? source
}

/** 给 Promise 加超时控制 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** 推断 skill 的分类：优先用 SKILL.md 声明 → 硬编码 MAP → 关键词匹配 */
export function inferCategoryKey(skill: PlatformSkillItem) {
  const explicit = normalizeCategory(skill.category)
  if (explicit !== 'uncategorized' && explicit !== '未分类') {
    return explicit
  }

  const mapped = SKILL_CATEGORY_MAP[skill.name]
  if (mapped) return mapped

  const text = [skill.name, skill.description, ...(skill.tags ?? [])].join(' ').toLowerCase()

  if (matchesCategory(text, ['design', 'figma', 'ui', 'ux', '视觉', '品牌', 'diagram'])) return 'design'
  if (matchesCategory(text, ['image', 'video', 'comic', 'translate', '翻译', 'cover', 'illustrator', 'photo', 'draw', 'paint', 'slide', 'deck', 'infographic', 'card', 'gifs', 'youtube', 'transcript', 'weibo', 'xhs', 'imagine', '漫画', '配图', '图片', '视频', '音频'])) return 'media'
  if (matchesCategory(text, ['frontend', 'react', 'vue', 'css', 'tailwind', 'web', 'html', 'browser', 'swiftui', 'iphone', 'macos', 'mobile', 'composition', 'component', '前端', '界面'])) return 'frontend'
  if (matchesCategory(text, ['backend', 'server', 'api', 'database', 'rust', 'go', 'mlops', 'ml', '后端'])) return 'backend'
  if (matchesCategory(text, ['test', 'qa', 'playwright', 'cypress', 'e2e', 'verify', 'check', '测试', '质量'])) return 'testing'
  if (matchesCategory(text, ['docs', 'readme', 'markdown', 'document', 'write', 'note', 'post', 'wechat', '文档', '写作', '公众号'])) return 'docs'
  if (matchesCategory(text, ['analysis', 'analyze', 'audit', 'inspect', 'analyst', 'investigate', '读懂', '分析', '代码分析', '评估'])) return 'analysis'
  if (matchesCategory(text, ['research', 'search', 'browse', 'collect', 'red.teaming', '研究', '搜索'])) return 'research'
  if (matchesCategory(text, ['memory', 'recall', 'knowledge', 'context', 'hub', '记忆', '知识'])) return 'memory'
  if (matchesCategory(text, ['debug', 'bug', 'fix', 'troubleshoot', 'guard', 'careful', 'safety', 'ship', 'deploy', 'release', 'plan', 'retro', 'freeze', 'unfreeze', 'lock', 'scope', '部署', '调试', '安全', '修复', '发布', '工程'])) return 'engineering'
  if (matchesCategory(text, ['install', 'setup', 'bootstrap', 'package', 'upgrade', 'configure', '安装', '配置'])) return 'install'
  if (matchesCategory(text, ['automation', 'workflow', 'sync', '自动化', '工作流'])) return 'automation'
  if (matchesCategory(text, ['system', 'macos', 'shell', 'terminal', 'local', 'devops', 'xcodebuild', 'cli', 'vercel', '系统'])) return 'system'
  if (matchesCategory(text, ['productivity', 'manager', 'organize', 'task', 'pattern', 'template', 'theme', 'refactor', '效率', '生产力'])) return 'productivity'

  return 'uncategorized'
}

function matchesCategory(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

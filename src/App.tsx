import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Copy,
  LoaderCircle,
  PackagePlus,
  PanelLeft,
  Route,
  Search,
  Settings2,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import './index.css'
import appIcon from '../src-tauri/icons/icon.png'
import {
  deletePlatformSkill,
  getDebugLogs as fetchDebugLogs,
  clearDebugLogs as clearDebugLogsBackend,
  installFromGitHub,
  openExternalUrl,
  onDebugLog,
  scanPlatforms,
  setDebugMode as setDebugModeBackend,
  getDebugMode as getDebugModeBackend,
  syncPlatformSkill,
  onSkillChanged,
} from './lib/tauri'
import type {
  InstallFromGitHubResult,
  PlatformGroup,
  PlatformKind,
  PlatformSkillItem,
} from './types'
import { AppDialog } from './components/ui'
import { COPY, STORAGE_KEYS, readStoredTheme, readStoredLanguage } from './constants/i18n'
import type { LanguagePreference, ThemePreference, Translate } from './constants/i18n'
import { PLATFORM_TABS } from './constants/platforms'
import { normalizeSkill, inferCategoryKey, categoryLabel, withTimeout, platformLabel } from './lib/skills'
import { PlatformGlyph, PlatformMiniBadge, CategoryIcon, SyncBadge } from './components/ui/badges'
import { DialogActions, SecondaryButton, DangerActionButton, EmptyState } from './components/ui/buttons'
import { SkillRow } from './components/SkillRow'
import { Inspector } from './components/Inspector'
import { SettingsPanel } from './components/SettingsPanel'
import { BootBanner } from './components/BootBanner'
import type { BootPhase } from './components/BootBanner'

type ModalKind = 'settings' | 'install-github' | null
type ViewScope = 'platform' | 'category' | 'skill'

type CategoryItem = {
  key: string
  label: string
  count: number
}

function App() {
  const [platformGroups, setPlatformGroups] = useState<PlatformGroup[]>([])
  const [activePlatform, setActivePlatform] = useState<PlatformKind>('codex')
  const activePlatformRef = useRef(activePlatform)
  activePlatformRef.current = activePlatform
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [viewScope, setViewScope] = useState<ViewScope>('skill')
  const [search, setSearch] = useState('')
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [pendingSyncSkill, setPendingSyncSkill] = useState<PlatformSkillItem | null>(null)
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<PlatformSkillItem | null>(null)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readStoredTheme())
  const [language, setLanguage] = useState<LanguagePreference>(() => readStoredLanguage())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [installResult, setInstallResult] = useState<InstallFromGitHubResult | null>(null)
  const [installPhase, setInstallPhase] = useState<'input' | 'cloning' | 'done' | 'error'>('input')
  const [installError, setInstallError] = useState<string | null>(null)
  const [debugMode, setDebugModeState] = useState(false)
  const [debugLogsOpen, setDebugLogsOpen] = useState(false)
  const [debugLogEntries, setDebugLogEntries] = useState<string[]>([])
  const debugLogEndRef = useRef<HTMLDivElement>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [bootPhase, setBootPhase] = useState<BootPhase>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [updatedPlatforms, setUpdatedPlatforms] = useState<Set<PlatformKind>>(new Set())
  const [highlightedSkillIds, setHighlightedSkillIds] = useState<Set<string>>(new Set())
  const skillListRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const knownSkillIdsRef = useRef<Set<string>>(new Set())
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshDataRef = useRef<(() => Promise<void>) | null>(null)
  const isFirstLoadRef = useRef(true)

  const loadData = useCallback(async () => {
    const firstLoad = isFirstLoadRef.current
    if (firstLoad) {
      setLoading(true)
    }
    setError(null)
    setBootPhase('starting')

    try {
      setBootPhase('scanning_platforms')
      const groups = await withTimeout(scanPlatforms(), 45000, t('loadingScan'))
      setBootPhase('loading_activity')
      const debugEnabled = await getDebugModeBackend().catch(() => false)
      setPlatformGroups(groups)
      setDebugModeState(debugEnabled)
      knownSkillIdsRef.current = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)))

      const nextGroup = groups.find((group) => group.platform === activePlatform) ?? groups[0] ?? null
      if (!nextGroup) {
        setSelectedSkillId(null)
        setBootPhase('ready')
        return
      }

      setActivePlatform(nextGroup.platform)
      setSelectedSkillId((current) => {
        if (current && nextGroup.skills.some((skill) => skill.id === current)) {
          return current
        }
        return nextGroup.skills[0]?.id ?? null
      })
      setViewScope((current) => (current === 'platform' || current === 'category' || current === 'skill' ? current : 'skill'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBootPhase('failed')
    } finally {
      isFirstLoadRef.current = false
      setLoading(false)
      setBootPhase((current) => (current === 'failed' ? current : 'ready'))
    }
  }, [activePlatform])

  const isInstallingRef = useRef(false)
  const [recentlyInstalledNames, setRecentlyInstalledNames] = useState<Set<string>>(new Set())

  const refreshData = useCallback(async () => {
    setError(null)
    try {
      const groups = await withTimeout(scanPlatforms(), 45000, COPY[language].loadingScan)
      const allIds = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)))
      knownSkillIdsRef.current = allIds
      setPlatformGroups(groups)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [language])

  refreshDataRef.current = refreshData

  useEffect(() => {
    if (mountedRef.current) {
      return
    }
    mountedRef.current = true
    queueMicrotask(() => {
      void loadData()
    })
  }, [loadData])

  // Debug log event listener
  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const existing = await fetchDebugLogs()
        if (existing.length > 0) setDebugLogEntries(existing)
      } catch {}
      unsub = await onDebugLog((msg) => {
        setDebugLogEntries((prev) => [...prev.slice(-499), msg])
      })
    })()
    return () => { if (unsub) unsub() }
  }, [])

  // Auto-scroll debug log to bottom on new entries
  useLayoutEffect(() => {
    const el = debugLogEndRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [debugLogEntries.length])

  // Global event logger — captures all user interactions automatically
  useEffect(() => {
    if (!debugMode) return

    const logEl = (el: HTMLElement | null): string => {
      if (!el) return ''
      const tag = el.tagName.toLowerCase()
      const text = (el.textContent || '').trim().slice(0, 40)
      const role = el.getAttribute('role') || ''
      const cls = el.className ? `.${String(el.className).split(' ').slice(0, 2).join('.')}` : ''
      return role ? `[${tag} role=${role}]` : text ? `[${tag}] ${text}` : `[${tag}${cls}]`
    }

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const closest = target.closest('button,a,[role="button"],[role="tab"],input,select')
      debugLog(`click: ${logEl(closest as HTMLElement || target)}`)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      debugLog(`keydown: ${e.key} ${logEl(target)}`)
    }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (resizeTimer) return
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        debugLog(`resize: ${window.innerWidth}x${window.innerHeight}`)
      }, 500)
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onResize)
    }
  }, [debugMode])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = themePreference === 'system' ? (media.matches ? 'dark' : 'light') : themePreference
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
    }
    applyTheme()
    const onChange = () => applyTheme()
    media.addEventListener('change', onChange)
    window.localStorage.setItem(STORAGE_KEYS.theme, themePreference)
    return () => media.removeEventListener('change', onChange)
  }, [themePreference])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.language, language)
  }, [language])

  // Set highlight (called from effects). New skill is sorted to top of list, no scroll needed.
  function applyHighlight(skillIds: Set<string>) {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    setHighlightedSkillIds(skillIds)
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedSkillIds(new Set())
      highlightTimerRef.current = null
    }, 3000)
  }

  // Highlight recently installed skills on current platform
  useEffect(() => {
    if (recentlyInstalledNames.size === 0) return
    const currentSkills = platformGroups
      .filter((g) => g.platform === activePlatform)
      .flatMap((g) => g.skills)
    const ids = currentSkills.filter((s) => recentlyInstalledNames.has(s.name)).map((s) => s.id)
    if (ids.length > 0) {
      applyHighlight(new Set(ids))
    }
  }, [platformGroups, activePlatform, recentlyInstalledNames])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    onSkillChanged((notices) => {
      const added = notices.filter((n) => n.action === 'added').map((n) => n.platform as PlatformKind)
      const removed = notices.filter((n) => n.action === 'removed').map((n) => n.platform as PlatformKind)
      // Green dot only for OTHER platforms (current platform gets auto-scroll + highlight)
      const otherPlatforms = added.filter((k) => k !== activePlatformRef.current)
      if (otherPlatforms.length > 0) {
        setUpdatedPlatforms((prev) => {
          const next = new Set(prev)
          for (const k of otherPlatforms) next.add(k)
          return next
        })
      }
      if (added.length > 0) {
        if (refreshDataRef.current) {
          void refreshDataRef.current()
        }
      }
      if (removed.length > 0) {
        void loadData()
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  const t = useCallback<Translate>((key) => COPY[language][key], [language])

  const activeGroup = useMemo(
    () => platformGroups.find((group) => group.platform === activePlatform) ?? null,
    [activePlatform, platformGroups],
  )

  const activeTab = useMemo(
    () => PLATFORM_TABS.find((tab) => tab.key === activePlatform) ?? PLATFORM_TABS[0],
    [activePlatform],
  )

  const normalizedSkills = useMemo(
    () => (activeGroup?.skills ?? []).map((skill) => normalizeSkill(skill, t('defaultSourceLabel'))),
    [activeGroup, t],
  )

  const categoryItems = useMemo<CategoryItem[]>(() => {
    const categoryCount = new Map<string, number>()

    for (const skill of normalizedSkills) {
      const key = inferCategoryKey(skill)
      categoryCount.set(key, (categoryCount.get(key) ?? 0) + 1)
    }

    return [
      { key: 'all', label: t('all'), count: normalizedSkills.length },
      ...[...categoryCount.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([key, count]) => ({
          key,
          label: categoryLabel(key, language),
          count,
        })),
    ]
  }, [language, normalizedSkills, t])

  const effectiveCategory =
    selectedCategory === 'all' || categoryItems.some((item) => item.key === selectedCategory)
      ? selectedCategory
      : 'all'

  const filteredSkills = useMemo(() => {
    const query = search.trim().toLowerCase()
    return normalizedSkills
      .filter((skill) => {
        const derivedCategory = inferCategoryKey(skill)
        const categoryMatch = effectiveCategory === 'all' || derivedCategory === effectiveCategory
        const queryMatch =
          !query ||
          [skill.name, skill.description, skill.githubUrl ?? '', skill.category, skill.sourceLabel, ...(skill.tags ?? [])]
            .join(' ')
            .toLowerCase()
            .includes(query)
        return categoryMatch && queryMatch
      })
      .sort((a, b) => {
        const aNew = recentlyInstalledNames.has(a.name) ? 0 : 1
        const bNew = recentlyInstalledNames.has(b.name) ? 0 : 1
        return aNew - bNew
      })
  }, [effectiveCategory, normalizedSkills, search, recentlyInstalledNames])

  const autoSelectedSkill =
    filteredSkills.find((skill) => skill.id === selectedSkillId) ??
    normalizedSkills.find((skill) => skill.id === selectedSkillId) ??
    filteredSkills[0] ??
    normalizedSkills[0] ??
    null

  const selectedSkill = viewScope === 'skill' ? autoSelectedSkill : null

  const counts = useMemo(
    () =>
      Object.fromEntries(platformGroups.map((group) => [group.platform, group.skills.length])) as Record<
        PlatformKind,
        number
      >,
    [platformGroups],
  )

  const activeCategoryItem = useMemo(
    () => categoryItems.find((item) => item.key === effectiveCategory) ?? categoryItems[0] ?? null,
    [categoryItems, effectiveCategory],
  )

  const breadcrumbItems = useMemo(
    () => [
      {
        key: 'root',
        label: t('localSkills'),
        current: false,
        onClick: () => {
          setSearch('')
          setSelectedCategory('all')
          setViewScope('platform')
        },
      },
      {
        key: 'platform',
        label: activeTab.label,
        current: false,
        onClick: () => {
          setSearch('')
          setSelectedCategory('all')
          setViewScope('platform')
        },
      },
      ...(effectiveCategory !== 'all' && activeCategoryItem
        ? [
            {
              key: 'category',
              label: activeCategoryItem.label,
              current: false,
              onClick: () => {
                setSearch('')
                setViewScope('category')
              },
            },
          ]
        : []),
      ...(viewScope === 'skill' && selectedSkill
        ? [
            {
              key: 'skill',
              label: selectedSkill.name,
              current: true,
              onClick: undefined,
            },
          ]
        : []),
    ],
    [activeCategoryItem, activeTab.label, effectiveCategory, selectedSkill, t, viewScope],
  )

  async function withRefresh(action: () => Promise<void>) {
    try {
      await action()
      await loadData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setWorkingAction(null)
    }
  }

  async function handleSync(skill: PlatformSkillItem, target: PlatformKind) {
    setWorkingAction(`sync-${skill.id}-${target}`)
    await withRefresh(async () => {
      await syncPlatformSkill(skill.path, skill.platform, target)
      setPendingSyncSkill(null)
    })
  }

  function handleDeleteRequest(skill: PlatformSkillItem) {
    setPendingDeleteSkill(skill)
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteSkill) return
    const deletingSkill = pendingDeleteSkill
    const list = normalizedSkills
    const idx = list.findIndex((item) => item.id === deletingSkill.id)
    const fallbackId = (list[idx + 1] ?? list[idx - 1] ?? null)?.id ?? null
    setWorkingAction(`deleting-${deletingSkill.id}`)
    try {
      await deletePlatformSkill(deletingSkill.installPath, deletingSkill.platform, false)
      await loadData()
      setSelectedSkillId((current) => (current === deletingSkill.id ? fallbackId : current))
      setPendingDeleteSkill(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setWorkingAction(null)
    }
  }

  async function handleOpenGithub(skill: PlatformSkillItem) {
    if (!skill.githubUrl) {
      return
    }
    setWorkingAction(`github-${skill.id}`)
    await withRefresh(async () => {
      await openExternalUrl(skill.githubUrl!)
    })
  }

  async function handleInstallFromGitHub() {
    const url = githubUrl.trim()
    if (!url) return

    setInstallError(null)
    setDuplicateWarning(null)

    // Check for duplicate skill by githubUrl — only block if installed on ALL platforms
    const normalizedUrl = url.replace(/\.git$/, '').replace(/\/+$/, '')
    const matchingSkills = platformGroups.flatMap((g) => g.skills).filter((s) => {
      if (!s.githubUrl) return false
      const normalized = s.githubUrl.replace(/\.git$/, '').replace(/\/+$/, '')
      return normalized === normalizedUrl
    })
    const platformCount = new Set(matchingSkills.map((s) => s.platform)).size
    debugLog(`[duplicate check] url=${normalizedUrl}, found on ${platformCount}/${PLATFORM_TABS.length} platforms`)
    if (platformCount >= PLATFORM_TABS.length) {
      setDuplicateWarning(matchingSkills[0].name)
      return
    }

    setWorkingAction('install-github')
    isInstallingRef.current = true

    // Force animation frame to paint "cloning" phase before blocking call
    await new Promise<void>((resolve) => {
      setInstallPhase('cloning')
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    try {
      const result = await installFromGitHub(url)
      setInstallResult(result)
      setInstallPhase('done')
      setRecentlyInstalledNames((prev) => new Set([...prev, result.skill.name]))
      await refreshData()
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause)
      setInstallError(enhanceInstallError(raw))
      setInstallPhase('error')
    } finally {
      isInstallingRef.current = false
      setWorkingAction(null)
    }
  }

  function enhanceInstallError(raw: string): string {
    const lang = language
    if (raw.includes('not found') || raw.includes('does not exist') || raw.includes('不存在')) {
      return raw + (lang === 'zh' ? '\n\n提示：请确认仓库 URL 正确且仓库是公开的。' : '\n\nTip: Verify the URL is correct and the repository is public.')
    }
    if (raw.includes('network') || raw.includes('resolve host') || raw.includes('网络')) {
      return raw + (lang === 'zh' ? '\n\n提示：请检查网络连接后重试。' : '\n\nTip: Check your network connection and try again.')
    }
    if (raw.includes('Permission denied') || raw.includes('authentication') || raw.includes('权限')) {
      return raw + (lang === 'zh' ? '\n\n提示：私有仓库需要配置 SSH 密钥或 git 凭据。' : '\n\nTip: Private repos require SSH keys or git credentials to be configured.')
    }
    if (raw.includes('git') && (raw.includes('not found') || raw.includes('not installed') || raw.includes('无法运行'))) {
      return raw + (lang === 'zh' ? '\n\n提示：请安装 git 后重试。' : '\n\nTip: Please install git and try again.')
    }
    return raw
  }

  function closeInstallDialog() {
    setModalKind(null)
    setGithubUrl('')
    setInstallResult(null)
    setInstallPhase('input')
    setInstallError(null)
    setDuplicateWarning(null)
  }

  async function handleToggleDebugMode(next: boolean) {
    setDebugModeState(next)
    setDebugLogsOpen(next)
    await setDebugModeBackend(next)
  }

  function debugLog(msg: string) {
    const ts = new Date().toLocaleTimeString()
    setDebugLogEntries((prev) => [...prev.slice(-499), `[${ts}] ${msg}`])
  }

  return (
    <div className="min-h-dvh bg-[var(--page-bg)] text-[var(--text-primary)]">
      <div className="flex min-h-dvh w-full flex-col px-3 py-3">
        <div className="desktop-panel flex h-[calc(100dvh-24px)] min-h-[720px] overflow-hidden rounded-[12px] border border-[var(--line-soft)] bg-[var(--chrome)]">
          <aside
            className={[
              'flex min-h-0 shrink-0 flex-col border-r border-[var(--line-soft)] bg-[var(--chrome)] transition-[width] duration-300 ease-out',
              sidebarCollapsed ? 'w-[72px]' : 'w-[252px]',
            ].join(' ')}
          >
            <div className="border-b border-[var(--line-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                {!sidebarCollapsed ? (
                  <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">
                    <img src={appIcon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
                    SkillKit
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                >
                  <PanelLeft className={`h-4 w-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            <div className="px-2 py-2">
              {!sidebarCollapsed ? <div className="px-2 pb-2 text-[13px] font-medium text-[var(--text-secondary)]">{t('platform')}</div> : null}
              <div className="space-y-1">
                {PLATFORM_TABS.map((tab) => {
                  const active = tab.key === activePlatform
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setActivePlatform(tab.key)
                        setSelectedCategory('all')
                        setViewScope('platform')
                        setUpdatedPlatforms((prev) => {
                          const next = new Set(prev)
                          next.delete(tab.key)
                          return next
                        })
                        // recentlyInstalledNames effect will handle highlight if skill is on this platform
                        const nextGroup = platformGroups.find((group) => group.platform === tab.key) ?? null
                        setSelectedSkillId(nextGroup?.skills[0]?.id ?? null)
                      }}
                      className={[
                        'flex w-full items-center rounded-[8px] px-2.5 py-2.5 text-left transition',
                        active ? 'bg-[var(--panel-1)]' : 'hover:bg-[var(--chrome-elevated)]',
                      ].join(' ')}
                      style={active ? { boxShadow: `inset 2px 0 0 ${tab.accent}` } : undefined}
                    >
                      <PlatformGlyph tab={tab} />
                      {!sidebarCollapsed ? (
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{tab.label}</div>
                          <div className="mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">{counts[tab.key] ?? 0}</div>
                        </div>
                      ) : null}
                      {updatedPlatforms.has(tab.key) ? (
                        <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 border-t border-[var(--line-soft)] px-2 py-3">
              {!sidebarCollapsed ? <div className="px-2 pb-2 text-[13px] font-medium text-[var(--text-secondary)]">{t('category')}</div> : null}
              <div className="skillhub-scroll space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100% - 28px)' }}>
                {categoryItems.map((category) => {
                  const active = effectiveCategory === category.key
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.key)
                        setViewScope(category.key === 'all' ? 'platform' : 'category')
                      }}
                      className={[
                        'flex w-full items-center rounded-[8px] px-2.5 py-2 text-left transition',
                        active
                          ? 'bg-[var(--panel-1)] text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]',
                      ].join(' ')}
                    >
                      <CategoryIcon categoryKey={category.key} />
                      {!sidebarCollapsed ? (
                        <>
                          <span className="ml-3 min-w-0 flex-1 truncate text-[13px]">{category.label}</span>
                          <span className="rounded-full bg-[var(--chrome-elevated)] px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)]">
                            {category.count}
                          </span>
                        </>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-auto border-t border-[var(--line-soft)] px-3 py-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setGithubUrl('')
                  setInstallResult(null)
                  setInstallPhase('input')
                  setInstallError(null)
                  setModalKind('install-github')
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-[13px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
              >
                <PackagePlus className="h-4 w-4" />
                {!sidebarCollapsed ? t('installFromGithub') : null}
              </button>
              <button
                type="button"
                onClick={() => setModalKind('settings')}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3 text-[13px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
              >
                <Settings2 className="h-4 w-4" />
                {!sidebarCollapsed ? t('settings') : null}
              </button>
              {debugMode ? (
                <button
                  type="button"
                  onClick={() => setDebugLogsOpen((v) => !v)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3 text-[13px] font-medium transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                  style={{ color: debugLogsOpen ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  <Terminal className="h-4 w-4" />
                  {!sidebarCollapsed ? t('debugLogs') : null}
                </button>
              ) : null}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-[var(--panel-0)]">
            <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--line-soft)] bg-[var(--chrome)] px-5">
              <div className="min-w-0 flex-1">
                <nav className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[13px]">
                  {breadcrumbItems.map((item, index) => (
                    <div key={item.key} className="flex min-w-0 items-center gap-1.5">
                      {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
                      {item.current ? (
                        <span className="truncate font-medium text-[var(--text-primary)]">{item.label}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={item.onClick}
                          className="truncate text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                        >
                          {item.label}
                        </button>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
              <div className="flex h-9 w-[320px] items-center gap-2 rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <section className="flex min-w-0 flex-1 flex-col border-r border-[var(--line-soft)]">
                <div className="border-b border-[var(--line-soft)] px-5 py-4">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[26px] font-medium tracking-[-0.03em] text-[var(--text-primary)]">{activeTab.label}</div>
                      <div className="mt-1 text-[14px] text-[var(--text-secondary)]">
                        {language === 'zh' ? `共 ${counts[activePlatform] ?? 0} 个` : `${counts[activePlatform] ?? 0}`}
                      </div>
                    </div>
                    <div />
                  </div>
                  {error ? (
                    <div className="mt-3 rounded-[8px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
                      {error}
                    </div>
                  ) : null}
                  {!error && loading ? <BootBanner phase={bootPhase} t={t} /> : null}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_104px_92px] items-center gap-4 border-b border-[var(--line-soft)] bg-[var(--chrome)] px-5 py-3 text-[13px] font-medium text-[var(--text-secondary)]">
                  <div>{t('skillsHeader')}</div>
                  <div>{t('statusHeader')}</div>
                  <div className="text-right">{t('actionHeader')}</div>
                </div>

                <div ref={skillListRef} className="skillhub-scroll min-h-0 flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="px-3 py-3">
                      {Array.from({ length: 10 }).map((_, index) => (
                        <div key={index} className="mb-2 h-[64px] animate-pulse rounded-[6px] border border-[var(--line-soft)] bg-[var(--panel-1)]" />
                      ))}
                    </div>
                  ) : filteredSkills.length === 0 ? (
                    <EmptyState title={t('noResults')} description={t('noResultsDesc')} />
                  ) : (
                    <div className="px-3 py-2">
                      {filteredSkills.map((skill) => (
                        <SkillRow
                          key={skill.id}
                          skill={skill}
                          tab={activeTab}
                          selected={selectedSkill?.id === skill.id}
                          highlighted={highlightedSkillIds.has(skill.id)}
                          workingAction={workingAction}
                          t={t}
                          onSelect={() => {
                            setSelectedSkillId(skill.id)
                            setViewScope('skill')
                          }}
                          onSync={() => setPendingSyncSkill(skill)}
                          onOpenGithub={() => void handleOpenGithub(skill)}
                          onDelete={() => handleDeleteRequest(skill)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside className="flex w-[390px] shrink-0 flex-col bg-[var(--chrome)]">
                <Inspector key={selectedSkillId ?? 'empty'} skill={selectedSkill} t={t} language={language} />
              </aside>
            </div>
          </div>
        </div>
      </div>

      <AppDialog
        open={modalKind === 'settings'}
        onOpenChange={(open) => !open && setModalKind(null)}
        title={t('settingsTitle')}
      >
          <SettingsPanel
            language={language}
            themePreference={themePreference}
            debugMode={debugMode}
            onLanguageChange={setLanguage}
            onThemeChange={setThemePreference}
            onDebugModeChange={handleToggleDebugMode}
            t={t}
          />
      </AppDialog>

      {pendingSyncSkill ? (
        <AppDialog
          open={Boolean(pendingSyncSkill)}
          onOpenChange={(open) => !open && setPendingSyncSkill(null)}
          title={language === 'zh' ? `同步 ${pendingSyncSkill.name}` : `Sync ${pendingSyncSkill.name}`}
          icon={<Route className="h-5 w-5" />}
        >
          <div className="space-y-2.5">
            {(pendingSyncSkill.syncTargets ?? []).map((target) => (
              <button
                key={target.target}
                type="button"
                disabled={target.state === 'conflict' || target.state === 'unavailable' || Boolean(workingAction)}
                onClick={() => void handleSync(pendingSyncSkill, target.target)}
                className="flex w-full items-center justify-between rounded-[12px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-4 py-3 text-left transition duration-150 hover:border-[var(--line-strong)] hover:bg-[var(--panel-1)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <PlatformMiniBadge platform={target.target} />
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">{platformLabel(target.target)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SyncBadge state={target.state} t={t} />
                  {workingAction === `sync-${pendingSyncSkill.id}-${target.target}` ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--accent)]" /> : null}
                </div>
              </button>
            ))}
          </div>
        </AppDialog>
      ) : null}

      {pendingDeleteSkill ? (
        <AppDialog
          open={Boolean(pendingDeleteSkill)}
          onOpenChange={(open) => !open && setPendingDeleteSkill(null)}
          title={language === 'zh' ? `卸载 "${pendingDeleteSkill.name}"？` : `Uninstall "${pendingDeleteSkill.name}"?`}
          hint={undefined}
          icon={undefined}
          variant="default"
          size="compact"
          showCloseButton={false}
          minimal
        >
          <div className="space-y-2">
            <DialogActions>
              <SecondaryButton label={t('cancel')} onClick={() => setPendingDeleteSkill(null)} />
              <DangerActionButton
                label={t('confirmDelete')}
                loading={workingAction === `deleting-${pendingDeleteSkill.id}`}
                onClick={() => void handleConfirmDelete()}
              />
            </DialogActions>
          </div>
        </AppDialog>
      ) : null}

      {modalKind === 'install-github' ? (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) closeInstallDialog()
          }}
          title={t('installFromGithubTitle')}
          icon={<PackagePlus className="h-5 w-5" />}
        >
          {installPhase === 'cloning' ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <LoaderCircle className="h-10 w-10 animate-spin text-[var(--accent)]" />
              <div className="space-y-1 text-center">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">{t('cloningRepo')}</div>
                <div className="text-[12px] text-[var(--text-muted)]">{githubUrl}</div>
              </div>
            </div>
          ) : installPhase === 'input' || installPhase === 'error' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => { setGithubUrl(e.target.value); setDuplicateWarning(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleInstallFromGitHub()
                }}
                placeholder="https://github.com/owner/repo"
                autoFocus
                className="w-full rounded-[10px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
              {duplicateWarning ? (
                <div className="rounded-[8px] border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3 py-2 text-[13px] text-[var(--warn-text)]">
                  {t('duplicateSkillDesc').replace('{name}', duplicateWarning)}
                </div>
              ) : null}
              {installError ? (
                <div className="whitespace-pre-wrap rounded-[8px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
                  {installError}
                </div>
              ) : null}
              <DialogActions>
                <SecondaryButton label={t('cancel')} onClick={closeInstallDialog} />
                <button
                  type="button"
                  onClick={() => void handleInstallFromGitHub()}
                  disabled={!githubUrl.trim()}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium text-white transition hover:opacity-90 active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('install')}
                </button>
              </DialogActions>
            </div>
          ) : installPhase === 'done' && installResult ? (
            <div className="space-y-3">
              <div className="rounded-[8px] border border-[var(--success-line)] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success-text)]">
                {t('installSuccess')}
              </div>
              <div className="text-[14px] text-[var(--text-primary)]">
                {installResult.skill.name}
              </div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                {installResult.skill.description || t('noDescription')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {installResult.installedPlatforms.map((p) => (
                  <PlatformMiniBadge key={p} platform={p} />
                ))}
              </div>
              <DialogActions>
                <SecondaryButton label={t('done')} onClick={closeInstallDialog} />
              </DialogActions>
            </div>
          ) : null}
        </AppDialog>
      ) : null}

      {/* Debug log panel */}
      {debugMode && debugLogsOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-40 flex h-[320px] w-[480px] flex-col rounded-[12px] border border-[var(--line-soft)] bg-[var(--chrome)] shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-soft)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{t('debugLogs')}</span>
              <span className="rounded-full bg-[var(--chrome-elevated)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                {debugLogEntries.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(debugLogEntries.join('\n')) }}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] px-2 text-[12px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => { clearDebugLogsBackend(); setDebugLogEntries([]) }}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] px-2 text-[12px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
              >
                <Trash2 className="h-3 w-3" />
                {t('clearLogs')}
              </button>
              <button
                type="button"
                onClick={() => setDebugLogsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-5 text-[var(--text-secondary)]" ref={debugLogEndRef}>
            {debugLogEntries.length === 0 ? (
              <div className="text-[var(--text-muted)]">Waiting for debug events...</div>
            ) : (
              debugLogEntries.map((entry, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{entry}</div>
              ))
            )}
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

export default App

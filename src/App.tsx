import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, LoaderCircle, Route, Search } from 'lucide-react'
import './index.css'
import {
  deletePlatformSkill,
  installFromGitHub,
  installMultipleFromGitHub,
  openExternalUrl,
  scanGitHubRepo,
  scanPlatforms,
  syncPlatformSkill,
  onSkillChanged,
  translateError,
} from './lib/tauri'
import type {
  GitHubSkillPreview,
  InstallFromGitHubResult,
  PlatformGroup,
  PlatformKind,
  PlatformSkillItem,
} from './types'
import { AppDialog } from './components/ui'
import { COPY } from './constants/i18n'
import type { Translate } from './constants/i18n'
import { PLATFORM_TABS } from './constants/platforms'
import { normalizeSkill, inferCategoryKey, categoryLabel, withTimeout, platformLabel } from './lib/skills'
import { PlatformMiniBadge, SyncBadge } from './components/ui/badges'
import { DialogActions, SecondaryButton, DangerActionButton, EmptyState } from './components/ui/buttons'
import { SkillRow } from './components/SkillRow'
import { Inspector } from './components/Inspector'
import { SettingsPanel } from './components/SettingsPanel'
import { BootBanner } from './components/BootBanner'
import { Sidebar } from './components/Sidebar'
import { InstallDialog } from './components/InstallDialog'
import { DebugPanel } from './components/DebugPanel'
import { usePreferences } from './hooks/usePreferences'
import { useDebugLog } from './hooks/useDebugLog'

type ModalKind = 'settings' | 'install-github' | null
type ViewScope = 'platform' | 'category' | 'skill'
type InstallPhase = 'input' | 'cloning' | 'selecting' | 'installing-multi' | 'done' | 'error'

type CategoryItem = {
  key: string
  label: string
  count: number
}

function App() {
  const prefs = usePreferences()
  const debug = useDebugLog()

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [installResult, setInstallResult] = useState<InstallFromGitHubResult | null>(null)
  const [multiInstallResults, setMultiInstallResults] = useState<InstallFromGitHubResult[]>([])
  const [installPhase, setInstallPhase] = useState<InstallPhase>('input')
  const [installError, setInstallError] = useState<string | null>(null)
  const [githubSkillPreviews, setGithubSkillPreviews] = useState<GitHubSkillPreview[]>([])
  const [selectedSkillIndices, setSelectedSkillIndices] = useState<Set<number>>(new Set())
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [updatedPlatforms, setUpdatedPlatforms] = useState<Set<PlatformKind>>(new Set())
  const [highlightedSkillIds, setHighlightedSkillIds] = useState<Set<string>>(new Set())
  const skillListRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const knownSkillIdsRef = useRef<Set<string>>(new Set())
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshDataRef = useRef<(() => Promise<void>) | null>(null)
  const isFirstLoadRef = useRef(true)
  const isInstallingRef = useRef(false)
  const [recentlyInstalledNames, setRecentlyInstalledNames] = useState<Set<string>>(new Set())

  const { language, setLanguage, themePreference, setThemePreference, sidebarCollapsed, setSidebarCollapsed, bootPhase, setBootPhase } = prefs
  const { debugMode, debugLogsOpen, setDebugLogsOpen, debugLogEntries, debugLogEndRef, handleToggleDebugMode } = debug

  const t = useCallback<Translate>((key) => COPY[language][key], [language])

  const loadData = useCallback(async () => {
    const firstLoad = isFirstLoadRef.current
    if (firstLoad) setLoading(true)
    setError(null)
    setBootPhase('starting')
    try {
      setBootPhase('scanning_platforms')
      const groups = await withTimeout(scanPlatforms(), 45000, t('loadingScan'))
      setBootPhase('loading_activity')
      const debugEnabled = await debug.initDebugMode().catch(() => false)
      setPlatformGroups(groups)
      debug.setDebugModeState?.(debugEnabled)
      knownSkillIdsRef.current = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)))
      const nextGroup = groups.find((group) => group.platform === activePlatform) ?? groups[0] ?? null
      if (!nextGroup) { setSelectedSkillId(null); setBootPhase('ready'); return }
      setActivePlatform(nextGroup.platform)
      setSelectedSkillId((current) => {
        if (current && nextGroup.skills.some((skill) => skill.id === current)) return current
        return nextGroup.skills[0]?.id ?? null
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBootPhase('failed')
    } finally {
      isFirstLoadRef.current = false
      setLoading(false)
      setBootPhase((current) => (current === 'failed' ? current : 'ready'))
    }
  }, [activePlatform, t, setBootPhase])

  const refreshData = useCallback(async () => {
    setError(null)
    try {
      const groups = await withTimeout(scanPlatforms(), 45000, COPY[language].loadingScan)
      knownSkillIdsRef.current = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)))
      setPlatformGroups(groups)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [language])

  refreshDataRef.current = refreshData

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    queueMicrotask(() => { void loadData() })
  }, [loadData])

  useEffect(() => {
    function applyHighlight(skillIds: Set<string>) {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      setHighlightedSkillIds(skillIds)
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedSkillIds(new Set())
        highlightTimerRef.current = null
      }, 3000)
    }
    if (recentlyInstalledNames.size === 0) return
    const currentSkills = platformGroups.filter((g) => g.platform === activePlatform).flatMap((g) => g.skills)
    const ids = currentSkills.filter((s) => recentlyInstalledNames.has(s.name)).map((s) => s.id)
    if (ids.length > 0) applyHighlight(new Set(ids))
  }, [platformGroups, activePlatform, recentlyInstalledNames])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    onSkillChanged((notices) => {
      const added = notices.filter((n) => n.action === 'added').map((n) => n.platform as PlatformKind)
      const removed = notices.filter((n) => n.action === 'removed').map((n) => n.platform as PlatformKind)
      const otherPlatforms = added.filter((k) => k !== activePlatformRef.current)
      if (otherPlatforms.length > 0) {
        setUpdatedPlatforms((prev) => {
          const next = new Set(prev)
          for (const k of otherPlatforms) next.add(k)
          return next
        })
      }
      if (added.length > 0 && refreshDataRef.current) void refreshDataRef.current()
      if (removed.length > 0) void loadData()
    }).then((fn) => { unlisten = fn })
    return () => {
      if (unlisten) unlisten()
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  const activeGroup = useMemo(() => platformGroups.find((group) => group.platform === activePlatform) ?? null, [activePlatform, platformGroups])
  const activeTab = useMemo(() => PLATFORM_TABS.find((tab) => tab.key === activePlatform) ?? PLATFORM_TABS[0], [activePlatform])
  const normalizedSkills = useMemo(() => (activeGroup?.skills ?? []).map((skill) => normalizeSkill(skill, t('defaultSourceLabel'))), [activeGroup, t])

  const categoryItems = useMemo<CategoryItem[]>(() => {
    const categoryCount = new Map<string, number>()
    for (const skill of normalizedSkills) {
      const key = inferCategoryKey(skill)
      categoryCount.set(key, (categoryCount.get(key) ?? 0) + 1)
    }
    return [
      { key: 'all', label: t('all'), count: normalizedSkills.length },
      ...[...categoryCount.entries()]
        .sort((l, r) => r[1] - l[1] || l[0].localeCompare(r[0]))
        .map(([key, count]) => ({ key, label: categoryLabel(key, language), count })),
    ]
  }, [language, normalizedSkills, t])

  const effectiveCategory = selectedCategory === 'all' || categoryItems.some((item) => item.key === selectedCategory) ? selectedCategory : 'all'

  const filteredSkills = useMemo(() => {
    const query = search.trim().toLowerCase()
    return normalizedSkills
      .filter((skill) => {
        const derivedCategory = inferCategoryKey(skill)
        const categoryMatch = effectiveCategory === 'all' || derivedCategory === effectiveCategory
        const queryMatch = !query || [skill.name, skill.description, skill.githubUrl ?? '', skill.category, skill.sourceLabel, ...(skill.tags ?? [])].join(' ').toLowerCase().includes(query)
        return categoryMatch && queryMatch
      })
      .sort((a, b) => {
        const aNew = recentlyInstalledNames.has(a.name) ? 0 : 1
        const bNew = recentlyInstalledNames.has(b.name) ? 0 : 1
        return aNew - bNew
      })
  }, [effectiveCategory, normalizedSkills, search, recentlyInstalledNames])

  const autoSelectedSkill = filteredSkills.find((skill) => skill.id === selectedSkillId) ?? normalizedSkills.find((skill) => skill.id === selectedSkillId) ?? filteredSkills[0] ?? normalizedSkills[0] ?? null
  const selectedSkill = viewScope === 'skill' ? autoSelectedSkill : null

  const counts = useMemo(() => Object.fromEntries(platformGroups.map((group) => [group.platform, group.skills.length])) as Record<PlatformKind, number>, [platformGroups])
  const activeCategoryItem = useMemo(() => categoryItems.find((item) => item.key === effectiveCategory) ?? categoryItems[0] ?? null, [categoryItems, effectiveCategory])

  const breadcrumbItems = useMemo(() => [
    { key: 'root', label: t('localSkills'), current: false, onClick: () => { setSearch(''); setSelectedCategory('all'); setViewScope('platform') } },
    { key: 'platform', label: activeTab.label, current: false, onClick: () => { setSearch(''); setSelectedCategory('all'); setViewScope('platform') } },
    ...(effectiveCategory !== 'all' && activeCategoryItem ? [{ key: 'category', label: activeCategoryItem.label, current: false, onClick: () => { setSearch(''); setViewScope('category') } }] : []),
    ...(viewScope === 'skill' && selectedSkill ? [{ key: 'skill', label: selectedSkill.name, current: true, onClick: undefined }] : []),
  ], [activeCategoryItem, activeTab.label, effectiveCategory, selectedSkill, t, viewScope])

  async function withRefresh(action: () => Promise<void>) {
    try { await action(); await loadData() }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setWorkingAction(null) }
  }

  async function handleSync(skill: PlatformSkillItem, target: PlatformKind) {
    setWorkingAction(`sync-${skill.id}-${target}`)
    await withRefresh(async () => { await syncPlatformSkill(skill.path, skill.platform, target); setPendingSyncSkill(null) })
  }

  function handleDeleteRequest(skill: PlatformSkillItem) { setPendingDeleteSkill(skill) }

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
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setWorkingAction(null) }
  }

  async function handleOpenGithub(skill: PlatformSkillItem) {
    if (!skill.githubUrl) return
    setWorkingAction(`github-${skill.id}`)
    await withRefresh(async () => { await openExternalUrl(skill.githubUrl!) })
  }

  async function handleInstallFromGitHub() {
    const url = githubUrl.trim()
    if (!url) return
    setInstallError(null)
    setDuplicateWarning(null)
    const normalizedUrl = url.replace(/\.git$/, '').replace(/\/+$/, '')
    const matchingSkills = platformGroups.flatMap((g) => g.skills).filter((s) => {
      if (!s.githubUrl) return false
      return s.githubUrl.replace(/\.git$/, '').replace(/\/+$/, '') === normalizedUrl
    })
    const platformCount = new Set(matchingSkills.map((s) => s.platform)).size
    debug.debugLog(`[duplicate check] url=${normalizedUrl}, found on ${platformCount}/${PLATFORM_TABS.length} platforms`)
    if (platformCount >= PLATFORM_TABS.length) { setDuplicateWarning(matchingSkills[0].name); return }
    setWorkingAction('install-github')
    isInstallingRef.current = true
    await new Promise<void>((resolve) => { setInstallPhase('cloning'); requestAnimationFrame(() => requestAnimationFrame(() => resolve())) })
    try {
      const scanResult = await scanGitHubRepo(url)
      if (scanResult.subpath) {
        const result = await installFromGitHub(url)
        setInstallResult(result); setInstallPhase('done')
        setRecentlyInstalledNames((prev) => new Set([...prev, result.skill.name]))
        await refreshData()
      } else if (scanResult.skills.length === 0) {
        setInstallError(translateError('{"code":"no_skill_md_in_repo","message":"No SKILL.md found in the repository"}', language))
        setInstallPhase('error')
      } else if (scanResult.skills.length === 1) {
        const result = await installFromGitHub(url)
        setInstallResult(result); setInstallPhase('done')
        setRecentlyInstalledNames((prev) => new Set([...prev, result.skill.name]))
        await refreshData()
      } else {
        setGithubSkillPreviews(scanResult.skills)
        setSelectedSkillIndices(new Set(scanResult.skills.map((_, i) => i)))
        setInstallPhase('selecting')
      }
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause)
      setInstallError(translateError(raw, language)); setInstallPhase('error')
    } finally { isInstallingRef.current = false; setWorkingAction(null) }
  }

  async function handleConfirmMultiInstall() {
    const url = githubUrl.trim()
    const selectedSubpaths = githubSkillPreviews.filter((_, i) => selectedSkillIndices.has(i)).map((p) => p.subpath)
    if (selectedSubpaths.length === 0) return
    setWorkingAction('install-github')
    isInstallingRef.current = true
    await new Promise<void>((resolve) => { setInstallPhase('installing-multi'); requestAnimationFrame(() => requestAnimationFrame(() => resolve())) })
    try {
      const results = await installMultipleFromGitHub(url, selectedSubpaths)
      setMultiInstallResults(results); setInstallPhase('done')
      for (const r of results) setRecentlyInstalledNames((prev) => new Set([...prev, r.skill.name]))
      await refreshData()
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause)
      setInstallError(translateError(raw, language)); setInstallPhase('error')
    } finally { isInstallingRef.current = false; setWorkingAction(null) }
  }

  function toggleSkillIndex(index: number) {
    setSelectedSkillIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedSkillIndices((prev) => {
      if (prev.size === githubSkillPreviews.length) return new Set()
      return new Set(githubSkillPreviews.map((_, i) => i))
    })
  }

  function closeInstallDialog() {
    setModalKind(null); setGithubUrl(''); setInstallResult(null); setMultiInstallResults([])
    setInstallPhase('input'); setInstallError(null); setDuplicateWarning(null)
    setGithubSkillPreviews([]); setSelectedSkillIndices(new Set())
  }

  return (
    <div className="min-h-dvh bg-[var(--page-bg)] text-[var(--text-primary)]">
      <div className="flex min-h-dvh w-full flex-col px-3 py-3">
        <div className="desktop-panel flex h-[calc(100dvh-24px)] min-h-[720px] overflow-hidden rounded-[12px] border border-[var(--line-soft)] bg-[var(--chrome)]">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            activePlatform={activePlatform}
            onPlatformChange={(key) => {
              setActivePlatform(key); setSelectedCategory('all'); setViewScope('platform')
              setUpdatedPlatforms((prev) => { const next = new Set(prev); next.delete(key); return next })
              const nextGroup = platformGroups.find((g) => g.platform === key) ?? null
              setSelectedSkillId(nextGroup?.skills[0]?.id ?? null)
            }}
            effectiveCategory={effectiveCategory}
            onCategoryChange={(key) => { setSelectedCategory(key); setViewScope(key === 'all' ? 'platform' : 'category') }}
            categoryItems={categoryItems}
            counts={counts}
            updatedPlatforms={updatedPlatforms}
            onClearUpdated={(key) => setUpdatedPlatforms((prev) => { const next = new Set(prev); next.delete(key); return next })}
            debugMode={debugMode}
            debugLogsOpen={debugLogsOpen}
            onToggleDebugLogs={() => setDebugLogsOpen((v) => !v)}
            onOpenInstall={() => { setGithubUrl(''); setInstallResult(null); setInstallPhase('input'); setInstallError(null); setModalKind('install-github') }}
            onOpenSettings={() => setModalKind('settings')}
            t={t}
          />

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
                        <button type="button" onClick={item.onClick} className="truncate text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">{item.label}</button>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
              <div className="flex h-9 w-[320px] items-center gap-2 rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
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
                    <div className="mt-3 rounded-[8px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger-text)]">{error}</div>
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
                          onSelect={() => { setSelectedSkillId(skill.id); setViewScope('skill') }}
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

      <AppDialog open={modalKind === 'settings'} onOpenChange={(open) => !open && setModalKind(null)} title={t('settingsTitle')}>
        <SettingsPanel language={language} themePreference={themePreference} debugMode={debugMode} onLanguageChange={setLanguage} onThemeChange={setThemePreference} onDebugModeChange={handleToggleDebugMode} t={t} />
      </AppDialog>

      {pendingSyncSkill ? (
        <AppDialog open onOpenChange={(open) => !open && setPendingSyncSkill(null)} title={language === 'zh' ? `同步 ${pendingSyncSkill.name}` : `Sync ${pendingSyncSkill.name}`} icon={<Route className="h-5 w-5" />}>
          <div className="space-y-2.5">
            {(pendingSyncSkill.syncTargets ?? []).map((target) => (
              <button key={target.target} type="button" disabled={target.state === 'conflict' || target.state === 'unavailable' || Boolean(workingAction)} onClick={() => void handleSync(pendingSyncSkill, target.target)} className="flex w-full items-center justify-between rounded-[12px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-4 py-3 text-left transition duration-150 hover:border-[var(--line-strong)] hover:bg-[var(--panel-1)] disabled:cursor-not-allowed disabled:opacity-55">
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
        <AppDialog open onOpenChange={(open) => !open && setPendingDeleteSkill(null)} title={language === 'zh' ? `卸载 "${pendingDeleteSkill.name}"？` : `Uninstall "${pendingDeleteSkill.name}"?`} hint={undefined} icon={undefined} variant="default" size="compact" showCloseButton={false} minimal>
          <div className="space-y-2">
            <DialogActions>
              <SecondaryButton label={t('cancel')} onClick={() => setPendingDeleteSkill(null)} />
              <DangerActionButton label={t('confirmDelete')} loading={workingAction === `deleting-${pendingDeleteSkill.id}`} onClick={() => void handleConfirmDelete()} />
            </DialogActions>
          </div>
        </AppDialog>
      ) : null}

      <InstallDialog
        open={modalKind === 'install-github'}
        onClose={closeInstallDialog}
        installPhase={installPhase}
        githubUrl={githubUrl}
        onGithubUrlChange={(url) => { setGithubUrl(url); setDuplicateWarning(null) }}
        onInstall={() => void handleInstallFromGitHub()}
        installError={installError}
        duplicateWarning={duplicateWarning}
        installResult={installResult}
        multiInstallResults={multiInstallResults}
        githubSkillPreviews={githubSkillPreviews}
        selectedSkillIndices={selectedSkillIndices}
        onToggleSkillIndex={toggleSkillIndex}
        onToggleSelectAll={toggleSelectAll}
        onConfirmMultiInstall={() => void handleConfirmMultiInstall()}
        t={t}
      />

      {debugMode && debugLogsOpen ? (
        <DebugPanel entries={debugLogEntries} endRef={debugLogEndRef} onClose={() => setDebugLogsOpen(false)} t={t} />
      ) : null}
    </div>
  )
}

export default App

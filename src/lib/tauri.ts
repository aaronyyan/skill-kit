import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  ActivityEntry,
  CreateSkillInput,
  DriftRecord,
  GitHubScanResult,
  InstallFromGitHubResult,
  PlatformGroup,
  PlatformKind,
  PlatformSkillItem,
  SettingsInfo,
  SkillRecord,
  TargetSummary,
} from '../types'

function normalizePlatformGroup(raw: unknown): PlatformGroup {
  const group = raw as Record<string, unknown>
  const skills = Array.isArray(group.skills)
    ? group.skills
    : Array.isArray(group.skill_list)
      ? group.skill_list
      : []

  return {
    platform: group.platform as PlatformKind,
    roots: Array.isArray(group.roots) ? (group.roots as string[]) : [],
    skills: skills.map((entry) => normalizePlatformSkill(entry)),
  }
}

function normalizePlatformSkill(raw: unknown) {
  const skill = raw as Record<string, unknown>
  const syncTargets = Array.isArray(skill.syncTargets)
    ? skill.syncTargets
    : Array.isArray(skill.sync_targets)
      ? skill.sync_targets
      : []

  return {
    id: String(skill.id ?? ''),
    name: String(skill.name ?? ''),
    category: String(skill.category ?? 'uncategorized'),
    tags: Array.isArray(skill.tags) ? (skill.tags as string[]) : [],
    description: String(skill.description ?? ''),
    githubUrl:
      typeof skill.githubUrl === 'string'
        ? skill.githubUrl
        : typeof skill.github_url === 'string'
          ? skill.github_url
          : null,
    path: String(skill.path ?? ''),
    installPath: String(skill.installPath ?? skill.install_path ?? skill.path ?? ''),
    rootLabel: String(skill.rootLabel ?? skill.root_label ?? ''),
    sourceLabel: String(skill.sourceLabel ?? skill.source_label ?? ''),
    platform: skill.platform as PlatformKind,
    managedRegistryId:
      typeof skill.managedRegistryId === 'string'
        ? skill.managedRegistryId
        : typeof skill.managed_registry_id === 'string'
          ? skill.managed_registry_id
          : null,
    syncTargets: syncTargets.map((target) => normalizeSyncTarget(target)),
  }
}

function normalizeSyncTarget(raw: unknown) {
  const target = raw as Record<string, unknown>
  return {
    target: target.target as PlatformKind,
    state: String(target.state ?? 'unavailable') as
      | 'ready'
      | 'synced'
      | 'conflict'
      | 'unavailable',
    path:
      typeof target.path === 'string'
        ? target.path
        : target.path == null
          ? null
          : String(target.path),
  }
}

export async function scanRegistry() {
  return invoke<SkillRecord[]>('scan_registry')
}

export async function scanTargets() {
  return invoke<TargetSummary[]>('scan_targets')
}

export async function detectDrift() {
  return invoke<DriftRecord[]>('detect_drift')
}

export async function createSkill(payload: CreateSkillInput) {
  return invoke<SkillRecord>('create_skill', { ...payload })
}

export async function installSkill(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('install_skill', { skillId, target })
}

export async function uninstallSkill(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('uninstall_skill', { skillId, target })
}

export async function syncSkill(skillId: string) {
  return invoke<SkillRecord>('sync_skill', { skillId })
}

export async function syncAll() {
  return invoke<SkillRecord[]>('sync_all')
}

export async function repairDrift(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('repair_drift', { skillId, target })
}

export async function getSettings() {
  return invoke<SettingsInfo>('get_settings')
}

export async function deleteSkill(skillId: string) {
  return invoke<void>('delete_skill', { skillId })
}

export async function getActivityLog() {
  return invoke<ActivityEntry[]>('get_activity_log')
}

export async function checkHomeAccess(): Promise<boolean> {
  return invoke<boolean>('check_home_access')
}

export async function scanPlatforms() {
  const result = await invoke<unknown[]>('scan_platforms')
  return Array.isArray(result) ? result.map((entry) => normalizePlatformGroup(entry)) : []
}

export async function syncPlatformSkill(
  sourcePath: string,
  sourcePlatform: PlatformKind,
  targetPlatform: PlatformKind,
) {
  return invoke<void>('sync_platform_skill', {
    sourcePath,
    sourcePlatform,
    targetPlatform,
  })
}

export async function deletePlatformSkill(
  path: string,
  platform: PlatformKind,
  removeManagedCopy = false,
) {
  return invoke<void>('delete_platform_skill', {
    path,
    platform,
    removeManagedCopy,
  })
}

export async function openExternalUrl(url: string) {
  return invoke<void>('open_external_url', { url })
}

export async function setDebugMode(enabled: boolean) {
  return invoke<void>('set_debug_mode', { enabled })
}

export async function getDebugMode() {
  return invoke<boolean>('get_debug_mode')
}

export async function getDebugLogs() {
  return invoke<string[]>('get_debug_logs')
}

export async function clearDebugLogs() {
  return invoke<void>('clear_debug_logs')
}

export function onDebugLog(callback: (msg: string) => void) {
  return listen<string>('debug-log', (event) => {
    callback(event.payload)
  })
}

export async function installFromGitHub(url: string) {
  const raw = await invoke<unknown>('install_from_github', { url })
  const data = raw as Record<string, unknown>
  const platforms = Array.isArray(data.installed_platforms)
    ? (data.installed_platforms as PlatformKind[])
    : Array.isArray(data.installedPlatforms)
      ? (data.installedPlatforms as PlatformKind[])
      : []
  const skillData = (data.skill ?? data) as Record<string, unknown>
  const skill: PlatformSkillItem = {
    id: String(skillData.id ?? ''),
    name: String(skillData.name ?? ''),
    category: String(skillData.category ?? 'uncategorized'),
    tags: Array.isArray(skillData.tags) ? (skillData.tags as string[]) : [],
    description: String(skillData.description ?? ''),
    githubUrl: typeof skillData.github_url === 'string' ? skillData.github_url : null,
    path: String(skillData.source_path ?? skillData.source_path ?? skillData.path ?? ''),
    installPath: String(skillData.source_path ?? skillData.path ?? ''),
    rootLabel: String(skillData.source_label ?? ''),
    sourceLabel: String(skillData.source_label ?? ''),
    platform: (skillData.platform as PlatformKind) ?? 'claude',
    managedRegistryId: null,
    syncTargets: [],
  }
  return {
    skill,
    installedPlatforms: platforms,
  }
}

export async function scanGitHubRepo(url: string): Promise<GitHubScanResult> {
  const raw = await invoke<unknown>('scan_github_repo', { url })
  const data = raw as Record<string, unknown>
  const skills = Array.isArray(data.skills)
    ? (data.skills as Array<Record<string, unknown>>).map((item) => ({
        name: String(item.name ?? ''),
        description: String(item.description ?? ''),
        subpath: String(item.subpath ?? ''),
      }))
    : []
  return {
    repoUrl: String(data.repo_url ?? data.repoUrl ?? ''),
    subpath: typeof data.subpath === 'string' ? data.subpath : null,
    skills,
  }
}

function normalizeInstallResult(raw: unknown): InstallFromGitHubResult {
  const data = raw as Record<string, unknown>
  const platforms = Array.isArray(data.installed_platforms)
    ? (data.installed_platforms as PlatformKind[])
    : Array.isArray(data.installedPlatforms)
      ? (data.installedPlatforms as PlatformKind[])
      : []
  const skillData = (data.skill ?? data) as Record<string, unknown>
  const skill: PlatformSkillItem = {
    id: String(skillData.id ?? ''),
    name: String(skillData.name ?? ''),
    category: String(skillData.category ?? 'uncategorized'),
    tags: Array.isArray(skillData.tags) ? (skillData.tags as string[]) : [],
    description: String(skillData.description ?? ''),
    githubUrl: typeof skillData.github_url === 'string' ? skillData.github_url : null,
    path: String(skillData.source_path ?? skillData.path ?? ''),
    installPath: String(skillData.source_path ?? skillData.path ?? ''),
    rootLabel: String(skillData.source_label ?? ''),
    sourceLabel: String(skillData.source_label ?? ''),
    platform: (skillData.platform as PlatformKind) ?? 'claude',
    managedRegistryId: null,
    syncTargets: [],
  }
  return { skill, installedPlatforms: platforms }
}

export async function installMultipleFromGitHub(url: string, subpaths: string[]): Promise<InstallFromGitHubResult[]> {
  const raw = await invoke<unknown>('install_multiple_from_github', { url, subpaths })
  const list = raw as Array<unknown>
  return list.map(normalizeInstallResult)
}

export async function onSkillChanged(
  callback: (notices: { platform: string; action: string }[]) => void,
) {
  return listen<{ platform: string; action: string }[]>('skill-changed', (event) => {
    callback(event.payload)
  })
}

export type PlatformKind = 'codex' | 'claude' | 'openclaw' | 'hermes'
export type InstallMode = 'symlink' | 'copy'
export type DriftStatus =
  | 'ok'
  | 'missing'
  | 'broken_link'
  | 'hash_mismatch'
  | 'unmanaged_conflict'

export type SyncState = 'ready' | 'synced' | 'conflict' | 'unavailable'

export interface SkillTargetStatus {
  target: PlatformKind
  installed: boolean
  path: string
  linkType: InstallMode | null
  driftStatus: DriftStatus
}

export interface SkillRecord {
  id: string
  name: string
  category: string
  tags: string[]
  sourcePath: string
  description: string
  targets: SkillTargetStatus[]
  installMode: InstallMode
  managed: boolean
  hash: string
  createdAt: string
  updatedAt: string
}

export interface TargetSkillEntry {
  name: string
  path: string
  managed: boolean
  hasSkillFile: boolean
  isSymlink: boolean
  registrySkillId: string | null
  status: DriftStatus
}

export interface TargetSummary {
  target: PlatformKind
  rootPath: string
  writable: boolean
  entries: TargetSkillEntry[]
}

export interface DriftRecord {
  skillId: string | null
  skillName: string
  target: PlatformKind
  path: string
  status: DriftStatus
  message: string
}

export interface SettingsInfo {
  registryRoot: string
  operationsLog: string
  installMode: InstallMode
  scanDepth: number
  ignoreRules: string[]
}

export interface ActivityEntry {
  timestamp: string
  action: string
}

export interface SyncTargetInfo {
  target: PlatformKind
  state: SyncState
  path: string | null
}

export interface PlatformSkillItem {
  id: string
  name: string
  category: string
  tags: string[]
  description: string
  githubUrl: string | null
  path: string
  installPath: string
  rootLabel: string
  sourceLabel: string
  platform: PlatformKind
  managedRegistryId: string | null
  syncTargets: SyncTargetInfo[]
}

export interface PlatformGroup {
  platform: PlatformKind
  roots: string[]
  skills: PlatformSkillItem[]
}

export interface CreateSkillInput {
  name: string
  category?: string
  description?: string
  tags?: string[]
}

export interface InstallFromGitHubResult {
  skill: PlatformSkillItem
  installedPlatforms: PlatformKind[]
}

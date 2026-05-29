// ── 基础类型 ──────────────────────────────────────────────────────

/** 支持的 AI 编码平台 */
export type PlatformKind = 'codex' | 'claude' | 'openclaw' | 'hermes'
/** skill 安装模式：symlink（registry 管理）或 copy（GitHub 安装） */
export type InstallMode = 'symlink' | 'copy'
/** 一致性检测状态 */
export type DriftStatus =
  | 'ok'                // 一致
  | 'missing'           // 目标不存在
  | 'broken_link'       // 符号链接断裂
  | 'hash_mismatch'     // 内容哈希不一致
  | 'unmanaged_conflict' // 存在未管理的目录

/** 同步状态 */
export type SyncState = 'ready' | 'synced' | 'conflict' | 'unavailable'

// ── Registry 数据结构 ─────────────────────────────────────────────

/** 单个平台上的 skill 安装状态 */
export interface SkillTargetStatus {
  target: PlatformKind
  installed: boolean
  path: string
  linkType: InstallMode | null
  driftStatus: DriftStatus
}

/** registry 中的 skill 记录（对应 skill.json） */
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

// ── 平台扫描数据结构 ─────────────────────────────────────────────

/** 目标平台扫描中的单个 skill 条目 */
export interface TargetSkillEntry {
  name: string
  path: string
  managed: boolean
  hasSkillFile: boolean
  isSymlink: boolean
  registrySkillId: string | null
  status: DriftStatus
}

/** 单个平台的扫描汇总 */
export interface TargetSummary {
  target: PlatformKind
  rootPath: string
  writable: boolean
  entries: TargetSkillEntry[]
}

/** 一致性检测记录 */
export interface DriftRecord {
  skillId: string | null
  skillName: string
  target: PlatformKind
  path: string
  status: DriftStatus
  message: string
}

// ── 应用设置与日志 ────────────────────────────────────────────────

/** 应用设置信息 */
export interface SettingsInfo {
  registryRoot: string
  operationsLog: string
  installMode: InstallMode
  scanDepth: number
  ignoreRules: string[]
}

/** 操作日志条目 */
export interface ActivityEntry {
  timestamp: string
  action: string
}

// ── 前端展示用的数据结构 ─────────────────────────────────────────

/** 同步目标信息 */
export interface SyncTargetInfo {
  target: PlatformKind
  state: SyncState
  path: string | null
}

/** 平台下的单个 skill 信息（前端主界面展示用） */
export interface PlatformSkillItem {
  id: string
  name: string
  category: string
  tags: string[]
  description: string
  githubUrl: string | null
  path: string            // skill 实际目录路径
  installPath: string     // 安装位置（可能是 symlink）
  rootLabel: string
  sourceLabel: string
  source: string          // 来源：codex / claude-code / skillkit / local
  platform: PlatformKind
  managedRegistryId: string | null
  syncTargets: SyncTargetInfo[]
}

/** 按平台分组的 skill 列表 */
export interface PlatformGroup {
  platform: PlatformKind
  roots: string[]
  skills: PlatformSkillItem[]
}

// ── GitHub 安装相关 ───────────────────────────────────────────────

/** 创建 skill 的输入参数 */
export interface CreateSkillInput {
  name: string
  category?: string
  description?: string
  tags?: string[]
}

/** GitHub 安装结果 */
export interface InstallFromGitHubResult {
  skill: PlatformSkillItem
  installedPlatforms: PlatformKind[]
}

/** GitHub 仓库扫描结果 */
export interface GitHubScanResult {
  repoUrl: string
  subpath: string | null
  skills: GitHubSkillPreview[]
}

/** 仓库中发现的 skill 预览 */
export interface GitHubSkillPreview {
  name: string
  description: string
  subpath: string
}

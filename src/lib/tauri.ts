// ── Tauri IPC 封装层 ─────────────────────────────────────────────
// 每个函数对应后端 lib.rs 中的一个 #[tauri::command]
// 通过 invoke 调用 Rust 后端，返回类型化的 Promise

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
  SettingsInfo,
  SkillRecord,
  TargetSummary,
} from '../types'
import { ERROR_COPY } from '../constants/i18n'
import type { LanguagePreference } from '../constants/i18n'

/** 将后端返回的原始数据转为 PlatformGroup 类型 */
function normalizePlatformGroup(raw: unknown): PlatformGroup {
  const group = raw as Record<string, unknown>
  return group as unknown as PlatformGroup
}

/** 解析后端返回的 JSON 错误，根据 code 查找对应语言的翻译文案 */
export function translateError(raw: string, lang: LanguagePreference): string {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.code && ERROR_COPY[parsed.code]) {
      return ERROR_COPY[parsed.code][lang]
    }
  } catch {
    // not JSON — return as-is
  }
  return raw
}

/** 扫描 registry 中所有已注册的 skill */
export async function scanRegistry() {
  return invoke<SkillRecord[]>('scan_registry')
}

/** 扫描所有平台的 skill 目录 */
export async function scanTargets() {
  return invoke<TargetSummary[]>('scan_targets')
}

/** 一致性检测 */
export async function detectDrift() {
  return invoke<DriftRecord[]>('detect_drift')
}

/** 在 registry 中创建新 skill */
export async function createSkill(payload: CreateSkillInput) {
  return invoke<SkillRecord>('create_skill', { ...payload })
}

/** 将 skill 安装到指定平台 */
export async function installSkill(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('install_skill', { skillId, target })
}

/** 从指定平台卸载 skill */
export async function uninstallSkill(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('uninstall_skill', { skillId, target })
}

/** 同步单个 skill 到所有已安装的平台 */
export async function syncSkill(skillId: string) {
  return invoke<SkillRecord>('sync_skill', { skillId })
}

/** 同步所有已注册的 skill */
export async function syncAll() {
  return invoke<SkillRecord[]>('sync_all')
}

/** 修复指定平台的 skill 一致性 */
export async function repairDrift(skillId: string, target: PlatformKind) {
  return invoke<SkillRecord>('repair_drift', { skillId, target })
}

/** 获取应用设置信息 */
export async function getSettings() {
  return invoke<SettingsInfo>('get_settings')
}

/** 从 registry 彻底删除 skill */
export async function deleteSkill(skillId: string) {
  return invoke<void>('delete_skill', { skillId })
}

/** 读取操作日志 */
export async function getActivityLog() {
  return invoke<ActivityEntry[]>('get_activity_log')
}

export async function checkHomeAccess(): Promise<boolean> {
  return invoke<boolean>('check_home_access')
}

/** 扫描所有平台，返回按平台分组的 skill 列表（主界面数据源） */
export async function scanPlatforms() {
  const result = await invoke<unknown[]>('scan_platforms')
  return Array.isArray(result) ? result.map((entry) => normalizePlatformGroup(entry)) : []
}

/** 跨平台同步：在目标平台创建指向源平台 skill 的 symlink */
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

/** 删除指定平台上的 skill */
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

/** 用系统默认浏览器打开外部 URL */
export async function openExternalUrl(url: string) {
  return invoke<void>('open_external_url', { url })
}

/** 开关调试模式 */
export async function setDebugMode(enabled: boolean) {
  return invoke<void>('set_debug_mode', { enabled })
}

/** 读取当前调试模式状态 */
export async function getDebugMode() {
  return invoke<boolean>('get_debug_mode')
}

/** 获取所有调试日志 */
export async function getDebugLogs() {
  return invoke<string[]>('get_debug_logs')
}

/** 清空调试日志 */
export async function clearDebugLogs() {
  return invoke<void>('clear_debug_logs')
}

/** 监听后端 debug-log 事件 */
export function onDebugLog(callback: (msg: string) => void) {
  return listen<string>('debug-log', (event) => {
    callback(event.payload)
  })
}

/** 从 GitHub 安装单个 skill */
export async function installFromGitHub(url: string): Promise<InstallFromGitHubResult> {
  return invoke<InstallFromGitHubResult>('install_from_github', { url })
}

/** 扫描 GitHub 仓库，找出所有包含 SKILL.md 的目录 */
export async function scanGitHubRepo(url: string): Promise<GitHubScanResult> {
  return invoke<GitHubScanResult>('scan_github_repo', { url })
}

/** 从 GitHub 仓库批量安装多个 skill */
export async function installMultipleFromGitHub(url: string, subpaths: string[]): Promise<InstallFromGitHubResult[]> {
  return invoke<InstallFromGitHubResult[]>('install_multiple_from_github', { url, subpaths })
}

/** 监听文件系统 skill 变更事件 */
export async function onSkillChanged(
  callback: (notices: { platform: string; action: string }[]) => void,
) {
  return listen<{ platform: string; action: string }[]>('skill-changed', (event) => {
    callback(event.payload)
  })
}

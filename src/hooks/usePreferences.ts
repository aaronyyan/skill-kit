// ── 用户偏好 Hook ─────────────────────────────────────────────────
// 管理主题、语言、侧边栏折叠、启动阶段等持久化偏好

import { useEffect, useState } from 'react'
import type { LanguagePreference, ThemePreference } from '../constants/i18n'
import { STORAGE_KEYS, readStoredTheme, readStoredLanguage } from '../constants/i18n'
import type { BootPhase } from '../components/BootBanner'

export function usePreferences() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readStoredTheme())
  const [language, setLanguage] = useState<LanguagePreference>(() => readStoredLanguage())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [bootPhase, setBootPhase] = useState<BootPhase>('idle')

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

  return {
    themePreference,
    setThemePreference,
    language,
    setLanguage,
    sidebarCollapsed,
    setSidebarCollapsed,
    bootPhase,
    setBootPhase,
  }
}

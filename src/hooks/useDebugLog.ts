// ── 调试日志 Hook ─────────────────────────────────────────────────
// 管理调试模式开关、日志条目、事件监听、自动滚动

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  getDebugLogs as fetchDebugLogs,
  clearDebugLogs as clearDebugLogsBackend,
  onDebugLog,
  setDebugMode as setDebugModeBackend,
  getDebugMode as getDebugModeBackend,
} from '../lib/tauri'

export function useDebugLog() {
  const [debugMode, setDebugModeState] = useState(false)
  const [debugLogsOpen, setDebugLogsOpen] = useState(false)
  const [debugLogEntries, setDebugLogEntries] = useState<string[]>([])
  const debugLogEndRef = useRef<HTMLDivElement>(null)

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

  useLayoutEffect(() => {
    const el = debugLogEndRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [debugLogEntries.length])

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
      debugLog(`click: ${logEl((closest as HTMLElement) || target)}`)
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

  const debugLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString()
    setDebugLogEntries((prev) => [...prev.slice(-499), `[${ts}] ${msg}`])
  }, [])

  const handleToggleDebugMode = useCallback(async (next: boolean) => {
    setDebugModeState(next)
    setDebugLogsOpen(next)
    await setDebugModeBackend(next)
  }, [])

  const clearLogs = useCallback(() => {
    clearDebugLogsBackend()
    setDebugLogEntries([])
  }, [])

  return {
    debugMode,
    debugLogsOpen,
    setDebugLogsOpen,
    debugLogEntries,
    debugLogEndRef,
    debugLog,
    handleToggleDebugMode,
    clearLogs,
    initDebugMode: getDebugModeBackend,
    setDebugModeState,
  }
}

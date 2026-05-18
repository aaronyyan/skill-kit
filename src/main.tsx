import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  }

  componentDidCatch(error: unknown) {
    console.error('SkillKit render failed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            background: '#f5f7fb',
            color: '#0f172a',
            padding: '32px',
            fontFamily: "'SF Pro Text', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif",
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '0.2em', opacity: 0.7 }}>SkillKit</div>
          <h1 style={{ fontSize: 28, margin: '12px 0 8px' }}>应用启动失败</h1>
          <p style={{ color: '#475569', maxWidth: 720, lineHeight: 1.7 }}>
            打包后的前端在启动时发生了运行时异常。下面是捕获到的错误信息。
          </p>
          <pre
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  console.error('window error:', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('unhandled rejection:', event.reason)
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('SkillKit root container was not found')
}

createRoot(rootElement).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
)

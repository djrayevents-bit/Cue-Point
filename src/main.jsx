import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initNative } from './native.js'

function showBootError(err) {
  const root = document.getElementById('root')
  if (!root) return
  const msg = err?.stack || err?.message || String(err)
  root.innerHTML = `
    <div style="font-family:-apple-system,system-ui,sans-serif;padding:28px 20px;max-width:520px;margin:40px auto;color:#16161A;width:100%;box-sizing:border-box">
      <div style="font-size:18px;font-weight:800;margin-bottom:8px">CuePoint failed to start</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:14px">
        The native shell loaded, but the web app crashed before painting. Screenshot this and rebuild after a fix.
      </div>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#F3F4F6;border-radius:12px;padding:12px;font-size:11px;color:#B91C1C">${String(msg).replace(/</g, '&lt;')}</pre>
    </div>
  `
}

window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (!root?.childElementCount) showBootError(e.error || e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root')
  if (!root?.childElementCount) showBootError(e.reason)
})

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[cuepoint] root crash', error, info)
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.stack || this.state.error?.message || String(this.state.error)
      return (
        <div style={{ fontFamily: '-apple-system,system-ui,sans-serif', padding: '28px 20px', maxWidth: 520, margin: '40px auto', color: '#16161A' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>CuePoint hit an error</div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 14 }}>
            Screenshot this red text — it tells us exactly what broke.
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F3F4F6', borderRadius: 12, padding: 12, fontSize: 11, color: '#B91C1C' }}>
            {msg}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '12px 18px', borderRadius: 12, border: 'none', background: '#6C4DF6', color: '#fff', fontWeight: 800, fontSize: 14 }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

async function boot() {
  try {
    await initNative()
  } catch (err) {
    console.warn('[cuepoint] initNative failed', err)
  }
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    )
  } catch (err) {
    showBootError(err)
    throw err
  }
}

boot().catch(showBootError)

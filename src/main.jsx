import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initNative } from './native.js'

function showBootError(err) {
  const root = document.getElementById('root')
  if (!root) return
  const msg = err?.stack || err?.message || String(err)
  root.innerHTML = `
    <div style="font-family:-apple-system,system-ui,sans-serif;padding:28px 20px;max-width:520px;margin:40px auto;color:#16161A">
      <div style="font-size:18px;font-weight:800;margin-bottom:8px">CuePoint failed to start</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:14px">
        The native shell loaded, but the web app crashed before painting. Screenshot this and rebuild after a fix.
      </div>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#F3F4F6;border-radius:12px;padding:12px;font-size:11px;color:#B91C1C">${msg.replace(/</g, '&lt;')}</pre>
    </div>
  `
}

window.addEventListener('error', (e) => {
  if (!document.getElementById('root')?.childElementCount) showBootError(e.error || e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  if (!document.getElementById('root')?.childElementCount) showBootError(e.reason)
})

async function boot() {
  try {
    await initNative()
  } catch (err) {
    console.warn('[cuepoint] initNative failed', err)
  }
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
    )
  } catch (err) {
    showBootError(err)
    throw err
  }
}

boot().catch(showBootError)

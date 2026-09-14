import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initNative } from './native.js'

async function boot() {
  await initNative()
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
}

boot()

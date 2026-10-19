import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Capacitor loads from capacitor://localhost — absolute `/assets/...` and
// `crossorigin` on module scripts commonly produce a blank white WebView.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'capacitor-html-fix',
      transformIndexHtml(html) {
        return html
          .replace(/\s+crossorigin(?:="[^"]*")?/g, '')
          .replace(/<script type="module" /g, '<script type="module" ')
      },
    },
  ],
})

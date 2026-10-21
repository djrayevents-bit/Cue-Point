import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Capacitor loads from capacitor://localhost. Absolute `/assets/...` and
// `crossorigin` on module scripts commonly produce a blank white WebView.
// Dynamic chunks also fail to resolve under that origin — keep one file.
export default defineConfig({
  base: './',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'capacitor-html-fix',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
      },
    },
  ],
})

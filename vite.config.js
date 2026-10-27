import { createRequire } from "node:module";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);

// Capacitor loads from capacitor://localhost. Absolute `/assets/...` and
// `crossorigin` on module scripts commonly produce a blank white WebView.
// Dynamic chunks also fail to resolve under that origin — keep one file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
  const tags = require("./api/_lib/equipmentTags.js");

  return {
    base: "./",
    // NFC taps need a LAN address the phone can open. `npm run dev` listens
    // on the network so Safari on that phone can hit /t/:id over plain http.
    server: { host: true },
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    plugins: [
      {
        name: "equipment-tags-http",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = String(req.url || "").split("?")[0];
            try {
              if (pathname.startsWith("/t/")) return await tags.handleTap(req, res);
              if (pathname === "/api/equipment-tags") return await tags.handleTags(req, res);
              if (pathname === "/api/equipment-operator") return await tags.handleOperator(req, res);
            } catch (error) {
              console.error("[equipment-tags]", error);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Equipment tags failed");
              }
              return;
            }
            next();
          });
        },
      },
      react(),
      {
        name: "capacitor-html-fix",
        transformIndexHtml(html) {
          return html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
        },
      },
    ],
  };
});

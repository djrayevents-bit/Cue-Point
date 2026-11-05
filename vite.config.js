import { createRequire } from "node:module";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);

// Web (Vercel) needs absolute asset URLs (`base: "/"`) so deep links like
// /app/portal/:handle/:eventId/:token can load JS. Relative `./` resolves
// assets under /app/portal/.../assets/ → 404 → blank white page.
// Capacitor still needs relative base under capacitor://localhost.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
  const tags = require("./api/_lib/equipmentTags.js");
  const capacitorBuild =
    process.env.CAPACITOR_BUILD === "1"
    || process.env.CAP_BASE === "relative"
    || mode === "capacitor";

  return {
    base: capacitorBuild ? "./" : "/",
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
      // SPA fallback for /app/portal/... (and other client routes) in vite preview/dev
      {
        name: "spa-app-fallback",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathname = String(req.url || "").split("?")[0];
            if (
              req.method === "GET"
              && !pathname.startsWith("/api/")
              && !pathname.startsWith("/src/")
              && !pathname.startsWith("/@")
              && !pathname.startsWith("/node_modules/")
              && !pathname.includes(".")
              && (pathname.startsWith("/app") || pathname.startsWith("/portal"))
            ) {
              req.url = "/index.html";
            }
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathname = String(req.url || "").split("?")[0];
            if (
              req.method === "GET"
              && !pathname.startsWith("/api/")
              && !pathname.includes(".")
              && (pathname.startsWith("/app") || pathname.startsWith("/portal"))
            ) {
              req.url = "/index.html";
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

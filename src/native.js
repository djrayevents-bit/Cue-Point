/**
 * Capacitor / native shell bootstrap.
 * No-op on the web (Vercel). On iOS/Android, rewrites /api calls to production
 * and tunes status bar, splash, and back-button behavior.
 */
import { Capacitor } from "@capacitor/core";

const API_BASE = "https://cuepointplanning.com";

function toProductionApiUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("/api/")) return API_BASE + url;
  // Capacitor may resolve relative /api calls to capacitor://localhost/api/...
  const marker = url.indexOf("/api/");
  if (marker === -1) return null;
  if (
    url.startsWith("capacitor://") ||
    url.startsWith("ionic://") ||
    url.startsWith("http://localhost") ||
    url.startsWith("https://localhost")
  ) {
    return API_BASE + url.slice(marker);
  }
  return null;
}

function rewriteApiFetch() {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      if (typeof input === "string") {
        const next = toProductionApiUrl(input);
        if (next) input = next;
      } else if (input instanceof Request) {
        const next = toProductionApiUrl(input.url);
        if (next) input = new Request(next, input);
      }
    } catch {
      /* keep original input */
    }
    return origFetch(input, init);
  };
}

function applyNativeFeel() {
  const style = document.createElement("style");
  style.setAttribute("data-cuepoint-native", "1");
  style.textContent = `
    :root {
      --safe-top: env(safe-area-inset-top);
      --safe-bottom: env(safe-area-inset-bottom);
    }
    html, body {
      overscroll-behavior: none;
      -webkit-tap-highlight-color: transparent;
    }
    * { -webkit-touch-callout: none; }
    *:not(input):not(textarea):not([contenteditable="true"]) {
      -webkit-user-select: none;
      user-select: none;
    }
    input, textarea, [contenteditable="true"] {
      -webkit-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);
}

export async function initNative() {
  if (!Capacitor?.isNativePlatform?.()) return;

  rewriteApiFetch();
  applyNativeFeel();

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* plugin optional during web builds */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* optional */
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {
    /* Android-focused; safe no-op on iOS */
  }
}

export function isNativeApp() {
  try {
    return !!Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

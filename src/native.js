/**
 * Capacitor / native shell bootstrap.
 * No-op on the web (Vercel). On iOS/Android, rewrites /api calls to production
 * via native HTTP (bypasses WebView CORS) and tunes status bar / splash / back.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { supabase } from "./supabase";
import { fetchEquipmentTag } from "./equipmentTagsApi";
import { parseEquipmentTagUrl, resolveEquipmentTagOpen } from "./equipmentTagTap";

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

function headersToObject(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function rewriteApiFetch() {
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      const apiUrl = toProductionApiUrl(rawUrl);
      if (apiUrl) {
        const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
        const headers = headersToObject(
          init.headers || (input instanceof Request ? input.headers : undefined)
        );
        let data = undefined;
        const body = init.body != null ? init.body : input instanceof Request ? undefined : undefined;
        // Prefer init.body; Request body can only be read once — auth uses init.body.
        const rawBody = init.body;
        if (rawBody != null && rawBody !== "") {
          if (typeof rawBody === "string") {
            try {
              data = JSON.parse(rawBody);
            } catch {
              data = rawBody;
            }
          } else {
            data = rawBody;
          }
        }

        const resp = await CapacitorHttp.request({
          url: apiUrl,
          method,
          headers,
          data,
        });

        const payload =
          typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? null);
        return new Response(payload, {
          status: resp.status,
          headers: resp.headers || { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      // Fall through to normal fetch if native HTTP fails unexpectedly
      console.warn("[cuepoint native] API request failed, falling back to fetch", err);
    }

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

function headerValue(headers, name) {
  if (!headers) return "";
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) {
      const value = headers[key];
      return Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
  }
  return "";
}

async function publicLocationFor(id) {
  const requested = `${API_BASE}/t/${id}?as=visitor`;
  try {
    const resp = await CapacitorHttp.request({
      url: requested,
      method: "GET",
      disableRedirects: true,
    });
    const fromHeader = headerValue(resp?.headers, "location");
    if (fromHeader) return fromHeader;
    if (resp?.url && resp.url !== requested) return resp.url;
  } catch (err) {
    console.warn("[cuepoint] equipment tag redirect failed", err);
  }
  return "";
}

function followTagTarget(target) {
  if (!target) return;
  if (target.type === "hash") {
    if (window.location.hash === target.hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = target.hash;
    }
    return;
  }
  window.open(target.url, "_blank", "noopener,noreferrer");
}

export async function openEquipmentTagUrl(raw) {
  const parsed = parseEquipmentTagUrl(raw);
  if (!parsed) return false;
  let signedIn = false;
  let ownerTag = null;
  if (!parsed.asVisitor) {
    try {
      const { data } = await supabase.auth.getSession();
      signedIn = !!data?.session?.access_token;
    } catch {
      signedIn = false;
    }
    if (signedIn) {
      try {
        const tag = await fetchEquipmentTag(parsed.id, { owner: true });
        if (tag && tag.inApp) ownerTag = tag;
      } catch {
        ownerTag = null;
      }
    }
  }
  const publicLocation = ownerTag ? "" : await publicLocationFor(parsed.id);
  followTagTarget(resolveEquipmentTagOpen({
    rawUrl: raw,
    signedIn,
    ownerTag,
    publicLocation,
  }));
  return true;
}

function installEquipmentTagTaps() {
  let lastUrl = "";
  let lastAt = 0;
  const handle = (url) => {
    if (!parseEquipmentTagUrl(url)) return;
    const now = Date.now();
    if (url === lastUrl && now - lastAt < 2000) return;
    lastUrl = url;
    lastAt = now;
    openEquipmentTagUrl(url).catch((err) => {
      console.warn("[cuepoint] equipment tag tap failed", err);
    });
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    let href = "";
    try {
      href = anchor.href;
    } catch {
      return;
    }
    if (!parseEquipmentTagUrl(href)) return;
    event.preventDefault();
    handle(href);
  }, true);

  import("@capacitor/app").then(({ App }) => {
    App.addListener("appUrlOpen", (event) => handle(event && event.url));
    return App.getLaunchUrl();
  }).then((launch) => {
    if (launch && launch.url) handle(launch.url);
  }).catch(() => {
    /* plugin optional during web builds */
  });
}

export async function initNative() {
  if (!Capacitor?.isNativePlatform?.()) return;

  installEquipmentTagTaps();
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

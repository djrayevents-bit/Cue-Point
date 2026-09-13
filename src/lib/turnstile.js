/**
 * Optional Cloudflare Turnstile helper.
 * When VITE_TURNSTILE_SITE_KEY is unset, returns null (server also skips).
 */

let scriptPromise = null;

function siteKey() {
  try {
    return String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim() || null;
  } catch {
    return null;
  }
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-cuepoint-turnstile]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.dataset.cuepointTurnstile = "1";
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * @returns {Promise<string|null>} token or null when captcha not configured
 */
export async function getTurnstileToken() {
  const key = siteKey();
  if (!key) return null;
  const turnstile = await loadTurnstileScript();
  if (!turnstile?.render) throw new Error("Captcha unavailable");

  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(host);
    let widgetId = null;
    const cleanup = () => {
      try {
        if (widgetId != null) turnstile.remove(widgetId);
      } catch {}
      host.remove();
    };
    try {
      widgetId = turnstile.render(host, {
        sitekey: key,
        size: "invisible",
        callback: (token) => {
          cleanup();
          resolve(token);
        },
        "error-callback": () => {
          cleanup();
          reject(new Error("Captcha failed"));
        },
        "expired-callback": () => {
          cleanup();
          reject(new Error("Captcha expired"));
        },
      });
      if (typeof turnstile.execute === "function") {
        turnstile.execute(widgetId);
      }
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

export function turnstileConfigured() {
  return !!siteKey();
}

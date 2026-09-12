/**
 * Allowlist HTML sanitizer for owner-authored client emails.
 * Strips scripts/handlers and unknown tags; keeps a small set used by CuePoint templates.
 */

const ALLOWED_TAGS = new Set([
  "div", "p", "br", "hr", "h1", "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "span",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "a",
]);

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeStyle(style) {
  const cleaned = String(style || "")
    .replace(/expression\s*\(/gi, "")
    .replace(/url\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/@import/gi, "")
    .slice(0, 400);
  return cleaned;
}

function sanitizeHref(href) {
  const h = String(href || "").trim();
  if (!h) return "";
  if (/^(https?:|mailto:)/i.test(h)) return h.slice(0, 500);
  if (h.startsWith("/") && !h.startsWith("//")) return h.slice(0, 500);
  return "";
}

/**
 * Very small tag allowlist pass. Unknown tags are dropped (contents kept).
 */
function sanitizeEmailHtml(html) {
  let out = String(html || "");

  // Remove dangerous blocks entirely
  out = out
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Drop event handlers + javascript: URLs early
  out = out
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  // Rewrite tags through allowlist
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, tagName, attrs) => {
    const tag = String(tagName).toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }
    if (closing) return `</${tag}>`;

    const selfClosing = tag === "br" || tag === "hr";
    let safeAttrs = "";

    if (tag === "a") {
      const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "") : "";
      const href = sanitizeHref(rawHref);
      if (href) safeAttrs += ` href="${escHtml(href)}"`;
      safeAttrs += ` rel="noopener noreferrer"`;
    }

    const styleMatch = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (styleMatch) {
      const style = sanitizeStyle(styleMatch[2] ?? styleMatch[3] ?? "");
      if (style) safeAttrs += ` style="${escHtml(style)}"`;
    }

    return selfClosing ? `<${tag}${safeAttrs} />` : `<${tag}${safeAttrs}>`;
  });

  return out.slice(0, 200_000);
}

function textToEmailHtml(text) {
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#1A1A2E;white-space:pre-wrap">${escHtml(text).replace(/\n/g, "<br/>")}</div>`;
}

function resolveEmailHtml({ html, text }) {
  if (html != null && String(html).trim()) return sanitizeEmailHtml(html);
  if (text != null && String(text).trim()) return textToEmailHtml(text);
  return null;
}

module.exports = {
  escHtml,
  sanitizeEmailHtml,
  textToEmailHtml,
  resolveEmailHtml,
};

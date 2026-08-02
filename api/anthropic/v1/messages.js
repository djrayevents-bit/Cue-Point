const { createClient } = require("@supabase/supabase-js");
const { hasPaidAccess } = require("../../_lib/entitlements");

// Simple in-memory rate limiter (resets on cold start — prefer Upstash in production)
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_TOKENS = 4096;
const MAX_MESSAGE_CHARS = 100_000;

function isRateLimited(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimitMap.set(userId, entry);
  return false;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const out = [];
  let totalChars = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    totalChars += content.length;
    if (totalChars > MAX_MESSAGE_CHARS) return null;
    out.push({ role: m.role, content: m.content });
  }
  return out.length ? out : null;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://cuepointplanning.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  if (!hasPaidAccess(user)) {
    return res.status(403).json({ error: "Paid plan required" });
  }

  if (isRateLimited(user.id)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Anthropic API key not configured" });

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Invalid or oversized messages" });
  }

  const maxTokens = Math.min(
    Math.max(1, Number(req.body?.max_tokens) || 1024),
    MAX_TOKENS
  );

  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    messages,
  };
  if (typeof req.body?.system === "string" && req.body.system.length <= 20_000) {
    body.system = req.body.system;
  }
  if (req.body?.temperature != null) {
    const t = Number(req.body.temperature);
    if (!Number.isNaN(t) && t >= 0 && t <= 1) body.temperature = t;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

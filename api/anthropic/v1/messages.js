const { createClient } = require("@supabase/supabase-js");
const { requirePaidUser } = require("../../_lib/auth");

// Simple in-memory rate limiter (resets on cold start — prefer Upstash in production)
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_TOKENS = 2048;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 12000;

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

/** Only allow chat-shaped bodies — never forward arbitrary Anthropic API options. */
function sanitizeMessagesBody(raw) {
  const incoming = Array.isArray(raw?.messages) ? raw.messages : [];
  if (incoming.length === 0) return { error: "messages required" };
  if (incoming.length > MAX_MESSAGES) return { error: "Too many messages" };

  const messages = [];
  for (const m of incoming) {
    const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : null;
    if (!role) return { error: "Invalid message role" };
    const content = typeof m.content === "string" ? m.content : null;
    if (content == null) return { error: "Only string message content is allowed" };
    if (content.length > MAX_MESSAGE_CHARS) return { error: "Message too long" };
    messages.push({ role, content });
  }

  let maxTokens = Number(raw?.max_tokens);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 1024;
  maxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS);

  return {
    body: {
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages,
      // Fixed system — callers cannot inject tools, system, or streaming overrides
      system: "You are a helpful assistant for CuePoint Planning, a DJ business app. Be concise and practical.",
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://cuepointplanning.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await requirePaidUser(req, res);
  if (!ctx) return;

  if (isRateLimited(ctx.user.id)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Anthropic API key not configured" });

  const sanitized = sanitizeMessagesBody(req.body);
  if (sanitized.error) return res.status(400).json({ error: sanitized.error });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(sanitized.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err.message);
    return res.status(500).json({ error: "AI request failed" });
  }
};

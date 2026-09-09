const { createClient } = require("@supabase/supabase-js");
const { requireOwner } = require("../../_lib/ownerAccess");

// Simple in-memory rate limiter (resets on cold start, good enough for Vercel)
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per user per minute

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

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin && [
    "https://cuepointplanning.com",
    "https://www.cuepointplanning.com",
    "http://localhost:5173",
    "http://localhost:5174",
  ].includes(origin) ? origin : "https://cuepointplanning.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const auth = await requireOwner(req, supabase);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  const { user } = auth;

  // Rate limit per user
  if (isRateLimited(user.id)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Anthropic API key not configured" });

  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!rawMessages.length) return res.status(400).json({ error: "messages required" });
  const messages = rawMessages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(0, 40)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 20000) }));
  if (!messages.length) return res.status(400).json({ error: "No valid messages" });

  const max_tokens = Math.min(Math.max(Number(req.body?.max_tokens) || 1024, 1), 2048);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens,
        messages,
      }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

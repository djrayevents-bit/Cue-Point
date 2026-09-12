/**
 * Open Anthropic Messages proxy — DISABLED (security Batch 1).
 *
 * Previously forwarded arbitrary authenticated request bodies to Anthropic,
 * which allowed spend abuse and unconstrained prompts/tools.
 * Use the controlled /api/cue/chat endpoint instead.
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://cuepointplanning.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  return res.status(410).json({
    error: "This Anthropic proxy has been disabled. Use /api/cue/chat instead.",
    code: "ANTHROPIC_PROXY_DISABLED",
  });
};

// Optional CSP report collector (report-only). No PII retention beyond short logs.
module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const report = body["csp-report"] || body;
    console.warn("csp-report", {
      documentUri: report?.["document-uri"] || report?.documentURI,
      violatedDirective: report?.["violated-directive"] || report?.violatedDirective,
      blockedUri: report?.["blocked-uri"] || report?.blockedURI,
      effectiveDirective: report?.["effective-directive"],
    });
  } catch (e) {
    console.warn("csp-report parse error", e.message);
  }
  return res.status(204).end();
};

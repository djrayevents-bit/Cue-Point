// Launch waitlist — disabled. CuePoint is a personal system.

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://cuepointplanning.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  return res.status(410).json({
    error: "Waitlist signup is closed. CuePoint is a private personal system.",
  });
};

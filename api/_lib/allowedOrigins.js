/** Shared browser origins allowed to call CuePoint APIs (CORS). */
module.exports = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5199",
  // Capacitor native shells (iOS / Android WebView)
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

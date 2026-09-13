/**
 * CuePoint private-OS mode (DJ Ray Events).
 * Default ON. Set CUEPOINT_PRIVATE_OS=false only if intentionally running multi-DJ SaaS.
 */
function isPrivateOs(env = process.env) {
  const v = String(env.CUEPOINT_PRIVATE_OS ?? "true").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no" && v !== "off";
}

module.exports = { isPrivateOs };

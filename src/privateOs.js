/**
 * CuePoint is DJ Ray Events' private business OS (not multi-DJ SaaS).
 * Flip only if you intentionally re-enable commercial signup/billing.
 */
export const CUEPOINT_PRIVATE_OS = true;

/** Public signup is closed in private-OS mode. */
export const PUBLIC_SIGNUP_ENABLED = !CUEPOINT_PRIVATE_OS;

/** Passwordless auth helpers — Email OTP or SMS OTP via Supabase. */

/** Normalize US-friendly input to E.164. Returns null if invalid. */
export const normalizePhoneE164 = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+') && digits.length >= 11 && digits.length <= 16) {
    return `+${digits.replace(/\D/g, '')}`;
  }
  const only = digits.replace(/\D/g, '');
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith('1')) return `+${only}`;
  if (only.length >= 10 && only.length <= 15) return `+${only}`;
  return null;
};

export const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const maskDestination = (channel, value) => {
  if (!value) return '';
  if (channel === 'email') {
    const [u, d] = String(value).split('@');
    if (!d) return value;
    const shown = u.length <= 2 ? `${u[0] || ''}*` : `${u.slice(0, 2)}***`;
    return `${shown}@${d}`;
  }
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4) return value;
  return `•••-•••-${digits.slice(-4)}`;
};

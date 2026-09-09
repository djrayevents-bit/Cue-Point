import { useState } from 'react';
import { supabase } from '../supabase';
import { BRAND_ACCENT, BRAND_FONT, BRAND_GRADIENT, BRAND_INK, BRAND_RADIUS } from '../brand';
import { isValidEmail, maskDestination, normalizePhoneE164 } from '../authOtp';

const AUTH_CARD = {
  width: '100%', maxWidth: 420, background: '#fff', borderRadius: 22,
  padding: '36px 32px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  boxSizing: 'border-box',
};
const AUTH_INPUT = {
  width: '100%', background: '#fff', border: '1px solid #E4E4EA', borderRadius: BRAND_RADIUS.field,
  padding: '13px 16px', color: BRAND_INK, fontSize: 15, fontFamily: BRAND_FONT,
  outline: 'none', boxSizing: 'border-box',
};
const AUTH_LABEL = {
  fontSize: 12, color: '#8E8E93', fontWeight: 700, marginBottom: 7, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: BRAND_FONT,
};
const AUTH_CTA = {
  width: '100%', padding: '14px 18px', border: 'none', borderRadius: 14,
  background: BRAND_GRADIENT, color: '#fff', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: BRAND_FONT, boxShadow: '0 8px 24px rgba(108,77,246,0.35)',
};

const ChannelToggle = ({ channel, onChange }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18,
    background: '#F1F1F6', borderRadius: 14, padding: 4,
  }}>
    {[
      { id: 'email', label: 'Email code' },
      { id: 'sms', label: 'Text message' },
    ].map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        style={{
          border: 'none', borderRadius: 10, padding: '11px 10px',
          fontFamily: BRAND_FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer',
          background: channel === opt.id ? '#fff' : 'transparent',
          color: channel === opt.id ? BRAND_ACCENT : '#8E8E93',
          boxShadow: channel === opt.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const focusBorder = {
  onFocus: (e) => { e.target.style.borderColor = BRAND_ACCENT; },
  onBlur: (e) => { e.target.style.borderColor = '#E4E4EA'; },
};

/**
 * Passwordless login — Email OTP or SMS OTP.
 * New accounts are not created (personal system).
 */
export function LoginPage({ AuthShell }) {
  const [channel, setChannel] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('identify');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const destination = channel === 'email' ? email.trim() : phone.trim();

  const sendCode = async () => {
    setError('');
    if (channel === 'email') {
      if (!isValidEmail(email)) { setError('Enter a valid email address.'); return; }
    } else {
      if (!normalizePhoneE164(phone)) { setError('Enter a valid mobile number.'); return; }
    }
    setLoading(true);
    try {
      const payload = channel === 'email'
        ? { email: email.trim(), options: { shouldCreateUser: false } }
        : { phone: normalizePhoneE164(phone), options: { shouldCreateUser: false } };
      const { error: otpErr } = await supabase.auth.signInWithOtp(payload);
      if (otpErr) {
        if (/signups not allowed|user not found|unable to validate/i.test(otpErr.message)) {
          setError('No account found. This CuePoint instance is private.');
        } else {
          setError(otpErr.message);
        }
        setLoading(false);
        return;
      }
      setSentTo(channel === 'email' ? email.trim() : normalizePhoneE164(phone));
      setStep('code');
      setCode('');
    } catch (e) {
      setError(e.message || 'Could not send code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError('');
    const token = code.trim().replace(/\s/g, '');
    if (!token || token.length < 6) { setError('Enter the 6-digit code we sent.'); return; }
    setLoading(true);
    try {
      const verify = channel === 'email'
        ? { email: sentTo || email.trim(), token, type: 'email' }
        : { phone: sentTo || normalizePhoneE164(phone), token, type: 'sms' };
      const { error: verifyErr } = await supabase.auth.verifyOtp(verify);
      if (verifyErr) { setError(verifyErr.message); setLoading(false); return; }
    } catch (e) {
      setError(e.message || 'Invalid code.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footerItems={['Private system', 'Password-free sign-in', 'Cloud synced']}
    >
      <div style={AUTH_CARD}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: BRAND_INK, marginBottom: 6 }}>Sign in</div>
        <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 22 }}>
          {step === 'identify'
            ? 'CuePoint is a private business system. We’ll email or text a one-time code.'
            : `Enter the code we sent to ${maskDestination(channel, sentTo)}.`}
        </div>

        {step === 'identify' && (
          <>
            <ChannelToggle channel={channel} onChange={(c) => { setChannel(c); setError(''); }} />
            {channel === 'email' ? (
              <div style={{ marginBottom: 18 }}>
                <label style={AUTH_LABEL}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  style={AUTH_INPUT}
                  {...focusBorder}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 18 }}>
                <label style={AUTH_LABEL}>Mobile number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  type="tel"
                  autoComplete="tel"
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  style={AUTH_INPUT}
                  {...focusBorder}
                />
              </div>
            )}
          </>
        )}

        {step === 'code' && (
          <div style={{ marginBottom: 18 }}>
            <label style={AUTH_LABEL}>One-time code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              style={{ ...AUTH_INPUT, letterSpacing: '0.2em', fontWeight: 700, fontSize: 18 }}
              {...focusBorder}
            />
            <button
              type="button"
              onClick={() => { setStep('identify'); setCode(''); setError(''); }}
              style={{
                marginTop: 10, background: 'none', border: 'none', color: BRAND_ACCENT,
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT, padding: 0,
              }}
            >
              ← Use a different {channel === 'email' ? 'email' : 'number'}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '11px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16,
          }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={step === 'identify' ? sendCode : verifyCode}
          disabled={loading || (step === 'identify' ? !destination : !code.trim())}
          style={{ ...AUTH_CTA, opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}
        >
          {loading
            ? (step === 'identify' ? 'Sending…' : 'Verifying…')
            : (step === 'identify' ? 'Send code →' : 'Sign in →')}
        </button>

        {step === 'code' && (
          <button
            type="button"
            disabled={loading}
            onClick={sendCode}
            style={{
              width: '100%', marginTop: 12, background: 'none', border: 'none',
              color: '#8E8E93', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT,
            }}
          >
            Resend code
          </button>
        )}
      </div>
    </AuthShell>
  );
}

/** Signup is disabled — personal instance. Kept so old imports do not break. */
export function SignupPage({ AuthShell }) {
  return <LoginPage AuthShell={AuthShell} />;
}

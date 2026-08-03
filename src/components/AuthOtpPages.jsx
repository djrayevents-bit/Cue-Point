import { useState } from 'react';
import { supabase } from '../supabase';
import { BRAND_ACCENT, BRAND_ACCENT_SOFT, BRAND_FONT, BRAND_GRADIENT, BRAND_INK, BRAND_RADIUS } from '../brand';
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
  fontSize: 11, color: '#8E8E93', fontWeight: 700, marginBottom: 7, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: BRAND_FONT,
};
const AUTH_CTA = {
  width: '100%', padding: '14px 18px', border: 'none', borderRadius: 14,
  background: BRAND_GRADIENT, color: '#fff', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: BRAND_FONT, boxShadow: '0 8px 24px rgba(108,77,246,0.35)',
};

const ChannelToggle = ({ channel, onChange }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18,
    background: '#F4F4F8', borderRadius: 12, padding: 4,
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

async function startCheckout({ accessToken, name, email }) {
  const res = await fetch('/api/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: 'checkout', name, ...(email ? { email } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.url) {
    window.location.href = data.url;
    return true;
  }
  return false;
}

/**
 * Passwordless login — Email OTP or SMS OTP.
 */
export function LoginPage({ AuthShell, goToSignup }) {
  const [channel, setChannel] = useState('email'); // email | sms
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('identify'); // identify | code
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
        // Friendlier message when account doesn't exist
        if (/signups not allowed|user not found|unable to validate/i.test(otpErr.message)) {
          setError('No account found for that contact. Start free to create one.');
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
      // onAuthStateChange will route into the app
    } catch (e) {
      setError(e.message || 'Invalid code.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      topRight={(
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
          New here?{' '}
          <span onClick={goToSignup} style={{ color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Start free →</span>
        </div>
      )}
      footerItems={['🔒 Password-free', '☁ Cloud synced', 'Works everywhere']}
    >
      <div style={AUTH_CARD}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: BRAND_INK, marginBottom: 6 }}>Welcome back</div>
        <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 22 }}>
          {step === 'identify'
            ? 'We’ll text or email you a one-time code — no password.'
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

/**
 * Passwordless signup — choose Email or Text for OTP; email always collected for billing.
 */
export function SignupPage({ AuthShell, goToLogin }) {
  const [channel, setChannel] = useState('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('identify'); // identify | code
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const sendCode = async () => {
    setError('');
    if (!name.trim()) { setError('Enter your DJ / business name.'); return; }
    if (!isValidEmail(email)) { setError('Enter a valid email (needed for billing & receipts).'); return; }
    if (channel === 'sms' && !normalizePhoneE164(phone)) {
      setError('Enter a valid mobile number for text codes.');
      return;
    }
    setLoading(true);
    try {
      const meta = {
        name: name.trim(),
        plan: 'trial',
        role: 'dj',
        preferred_auth: channel,
        billing_email: email.trim(),
      };
      let otpErr;
      if (channel === 'email') {
        ({ error: otpErr } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { data: meta, shouldCreateUser: true },
        }));
        setSentTo(email.trim());
      } else {
        const e164 = normalizePhoneE164(phone);
        ({ error: otpErr } = await supabase.auth.signInWithOtp({
          phone: e164,
          options: { data: meta, shouldCreateUser: true },
        }));
        setSentTo(e164);
      }
      if (otpErr) { setError(otpErr.message); setLoading(false); return; }
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
      const { data, error: verifyErr } = await supabase.auth.verifyOtp(verify);
      if (verifyErr) { setError(verifyErr.message); setLoading(false); return; }

      const session = data?.session;
      if (!session?.access_token) {
        setError('Signed in, but no session yet. Try again.');
        setLoading(false);
        return;
      }

      // Attach billing email for SMS-first accounts (Stripe requires email)
      if (channel === 'sms' && isValidEmail(email)) {
        await supabase.auth.updateUser({
          email: email.trim(),
          data: {
            name: name.trim(),
            plan: 'trial',
            role: 'dj',
            preferred_auth: 'sms',
            billing_email: email.trim(),
          },
        }).catch(() => {});
      } else {
        await supabase.auth.updateUser({
          data: {
            name: name.trim(),
            plan: 'trial',
            role: 'dj',
            preferred_auth: channel,
            billing_email: email.trim(),
          },
        }).catch(() => {});
      }

      const started = await startCheckout({
        accessToken: session.access_token,
        name: name.trim(),
        email: email.trim(),
      });
      if (!started) {
        // Auth succeeded — App will pick up session; Stripe can retry from app
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || 'Could not verify code.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      topRight={(
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
          Have an account?{' '}
          <span onClick={goToLogin} style={{ color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Sign in →</span>
        </div>
      )}
      footerItems={['🔒 Password-free', '☁ Cloud synced', 'Clients sign from any device']}
    >
      <div style={AUTH_CARD}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: BRAND_INK, marginBottom: 18 }}>
          Create your account
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          background: BRAND_ACCENT_SOFT, border: `1px solid ${BRAND_ACCENT}35`,
          borderRadius: 14, padding: '14px 16px',
        }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, color: BRAND_ACCENT, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            $20<span style={{ fontSize: 13, fontWeight: 600 }}>/mo</span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND_ACCENT, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Founding Member</div>
            <div style={{ fontSize: 12, color: '#6B6B76', lineHeight: 1.4 }}>Locked for life · first 25 only — then $50/mo</div>
          </div>
        </div>

        {step === 'identify' && (
          <>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 10, lineHeight: 1.45 }}>
              How should we send your sign-in codes?
            </div>
            <ChannelToggle channel={channel} onChange={(c) => { setChannel(c); setError(''); }} />

            <div style={{ marginBottom: 14 }}>
              <label style={AUTH_LABEL}>Your DJ / Business Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DJ Smith" style={AUTH_INPUT} {...focusBorder} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={AUTH_LABEL}>Email {channel === 'sms' ? '(billing & receipts)' : ''}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                style={AUTH_INPUT}
                {...focusBorder}
              />
            </div>
            {channel === 'sms' && (
              <div style={{ marginBottom: 14 }}>
                <label style={AUTH_LABEL}>Mobile number (for codes)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  type="tel"
                  autoComplete="tel"
                  style={AUTH_INPUT}
                  {...focusBorder}
                />
              </div>
            )}
          </>
        )}

        {step === 'code' && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 14, lineHeight: 1.5 }}>
              We sent a code to <strong style={{ color: BRAND_INK }}>{maskDestination(channel, sentTo)}</strong>.
            </div>
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
              ← Edit details
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
          disabled={loading}
          style={{ ...AUTH_CTA, opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}
        >
          {loading
            ? (step === 'identify' ? 'Sending code…' : 'Creating account…')
            : (step === 'identify' ? 'Send code →' : 'Verify & continue →')}
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

        <div style={{ fontSize: 12, color: '#AEAEB2', textAlign: 'center', marginTop: 14, lineHeight: 1.55 }}>
          $20/mo after setup · cancel anytime.<br />
          By signing up you agree to our <span style={{ color: BRAND_INK, fontWeight: 600 }}>Terms of Service</span>.
        </div>
      </div>
    </AuthShell>
  );
}

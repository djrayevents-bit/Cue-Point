import { useState } from 'react';
import { BRAND_FONT, LIGHT_THEME } from '../brand';
import { callCueChat, parseCueResponse } from '../cueActions';
import CueActionPreview from './CueActionPreview';

const C = LIGHT_THEME;

/**
 * Standalone preview→confirm modal for CUE intents (new event, lead email, etc.).
 */
export default function CueIntentModal({
  title,
  subtitle,
  intent,
  initialPrompt = '',
  buildRequest,
  packages = [],
  existingCount = 0,
  onClose,
  onApplied,
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [actions, setActions] = useState([]);
  const [writeMode, setWriteMode] = useState('replace');
  const [error, setError] = useState('');

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setActions([]);
    setReply('');
    try {
      const body = buildRequest(text);
      const data = await callCueChat({ ...body, intent, message: text });
      const parsed = parseCueResponse(data, { packages });
      setReply(parsed.reply);
      setActions(parsed.actions);
      if (!parsed.actions.length && !parsed.reply) {
        setError('CUE returned an empty response. Try again.');
      }
    } catch (e) {
      setError(e.message || 'CUE request failed');
    } finally {
      setLoading(false);
    }
  };

  const primary = actions[0] || null;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>{title}</div>
            {subtitle && <div style={S.sub}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} style={S.x}>×</button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe what you need…"
          style={S.ta}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" style={S.primary} disabled={loading || !prompt.trim()} onClick={generate}>
            {loading ? 'Thinking…' : 'Generate with CUE'}
          </button>
        </div>

        {error && <div style={S.err}>{error}</div>}
        {reply && <div style={S.reply}>{reply}</div>}

        {primary && (
          <CueActionPreview
            action={primary}
            existingCount={existingCount}
            writeMode={writeMode}
            onWriteModeChange={setWriteMode}
            onConfirm={(meta) => {
              onApplied?.(primary, { ...(meta || {}), mode: writeMode });
            }}
            onDismiss={() => setActions([])}
          />
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(22,22,26,0.45)', zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto',
    background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
    padding: 20, fontFamily: BRAND_FONT, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  title: { fontWeight: 900, fontSize: 18, color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: 4 },
  x: { background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer' },
  ta: {
    width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${C.border}`,
    padding: 12, fontSize: 14, fontFamily: BRAND_FONT, resize: 'vertical', marginBottom: 10,
    background: C.bg, color: C.text,
  },
  primary: {
    background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  err: { color: C.red, fontSize: 13, marginBottom: 8 },
  reply: {
    fontSize: 13, lineHeight: 1.55, color: C.text, background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 12, marginBottom: 8, whiteSpace: 'pre-wrap',
  },
};

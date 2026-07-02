import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import { BRAND_ACCENT, BRAND_FONT, BRAND_GRADIENT, BRAND_INK, BRAND_RADIUS, LIGHT_THEME } from '../brand';

const C = LIGHT_THEME;

const CueSparkIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2.5l1.2 4.8L18 8.5l-4.8 1.2L12 14.5l-1.2-4.8L6 8.5l4.8-1.2L12 2.5zM18.5 14l.7 2.8 2.8.7-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8 2.8-.7-2.8-.7z"
      fill={color}
    />
  </svg>
);

export default function CueAssistant({ open, onClose }) {
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!open) return;
    try {
      const evs = JSON.parse(localStorage.getItem('cuepoint_events') || '[]');
      setEvents(evs);
      if (evs.length && !eventId) setEventId(String(evs[0].id));
    } catch { setEvents([]); }
  }, [open]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/cue/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          eventId: eventId || null,
          event: (() => {
            const ev = events.find(e => String(e.id) === String(eventId));
            if (!ev) return null;
            const total = Number(ev.totalFee) || 0;
            const paid = Number(ev.depositPaid) || 0;
            return {
              ...ev,
              _computed: {
                total_fee: total,
                amount_paid: paid,
                balance_remaining: total - paid,
                deposit_status: paid > 0 ? 'Paid' : 'Pending',
              },
            };
          })(),
          history: messages,
        }),
      });
      const data = await res.json();
      setMessages([...nextHistory, { role: 'assistant', content: data.reply || data.error || '...' }]);
    } catch {
      setMessages([...nextHistory, { role: 'assistant', content: 'CUE hit an error. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selectedEvent = events.find(e => String(e.id) === String(eventId));

  return (
    <>
      <div onClick={onClose} style={S.backdrop} aria-hidden />
      <div style={S.panel}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.headerIcon}>
              <CueSparkIcon size={16} />
            </div>
            <div>
              <div style={S.headerTitle}>CUE Assistant</div>
              <div style={S.headerStatus}>
                <span style={S.statusDot} />
                {loading ? 'Thinking…' : 'Ready to help'}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={S.close} aria-label="Close">×</button>
        </div>

        {events.length > 0 && (
          <div style={S.eventRow}>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={S.eventSelect}>
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name || ev.client || 'Untitled'}{ev.date ? ` — ${ev.date}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div ref={scrollRef} style={S.body}>
          {messages.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}><CueSparkIcon size={22} color={BRAND_ACCENT} /></div>
              <div style={S.emptyTitle}>Ask CUE anything</div>
              <div style={S.emptySub}>
                {selectedEvent
                  ? `Focused on ${selectedEvent.name || selectedEvent.client || 'this event'} — timeline, songs, contacts, what's missing.`
                  : 'Plan any event with AI — pick an event above or ask about your whole business.'}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? S.user : S.bot}>{m.content}</div>
            ))
          )}
          {loading && messages.length > 0 && <div style={S.bot}>…</div>}
        </div>

        <div style={S.footer}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask CUE anything…"
            style={S.input}
          />
          <button type="button" onClick={send} disabled={loading || !input.trim()} style={S.send} aria-label="Send">
            →
          </button>
        </div>
      </div>
    </>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(22, 22, 26, 0.18)', zIndex: 9998,
  },
  panel: {
    position: 'fixed', right: 16, top: 16, bottom: 16, width: 380, maxWidth: 'calc(100vw - 32px)',
    background: C.surface, borderRadius: BRAND_RADIUS.card, display: 'flex', flexDirection: 'column',
    boxShadow: '0 12px 48px rgba(22, 22, 26, 0.14)', zIndex: 9999, fontFamily: BRAND_FONT,
    border: `1px solid ${C.border}`, overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: C.bg, borderBottom: `1px solid ${C.border}`,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10, background: BRAND_GRADIENT,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 15, color: BRAND_INK, letterSpacing: '-0.02em' },
  headerStatus: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: C.green, flexShrink: 0 },
  close: {
    background: C.surface, border: `1px solid ${C.border}`, color: C.muted,
    fontSize: 20, lineHeight: 1, cursor: 'pointer', width: 32, height: 32,
    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  eventRow: { padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface },
  eventSelect: {
    width: '100%', padding: '8px 12px', borderRadius: BRAND_RADIUS.field,
    border: `1px solid ${C.border}`, background: C.bg, color: BRAND_INK,
    fontSize: 13, fontFamily: BRAND_FONT,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column',
    gap: 12, background: C.surface,
  },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 12px' },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 14, background: '#EFEBFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontWeight: 800, fontSize: 17, color: BRAND_INK, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.muted, lineHeight: 1.55, maxWidth: 280 },
  user: {
    alignSelf: 'flex-end', background: BRAND_GRADIENT, color: '#fff',
    padding: '10px 14px', borderRadius: '16px 4px 16px 16px', maxWidth: '88%',
    whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5,
  },
  bot: {
    alignSelf: 'flex-start', background: C.bg, border: `1px solid ${C.border}`,
    padding: '10px 14px', borderRadius: '4px 16px 16px 16px', maxWidth: '88%',
    whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5, color: BRAND_INK,
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 14,
    borderTop: `1px solid ${C.border}`, background: C.bg,
  },
  input: {
    flex: 1, padding: '12px 16px', borderRadius: BRAND_RADIUS.pill,
    border: `1px solid ${C.border}`, background: C.surface, color: BRAND_INK,
    fontSize: 14, fontFamily: BRAND_FONT, outline: 'none',
  },
  send: {
    width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
    background: BRAND_ACCENT, color: '#fff', cursor: 'pointer', fontSize: 18,
    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(108, 77, 246, 0.35)',
  },
};

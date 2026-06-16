import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';

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
        body: JSON.stringify({ message: text, eventId: eventId || null, event: (() => {
          const ev = events.find(e => String(e.id) === String(eventId));
          if (!ev) return null;
          const total = Number(ev.totalFee) || 0;
          const paid = Number(ev.depositPaid) || 0;
          const balanceRemaining = total - paid;
          return { ...ev, _computed: { total_fee: total, amount_paid: paid, balance_remaining: balanceRemaining, deposit_status: paid > 0 ? "Paid" : "Pending" } };
        })(), history: messages }),
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

  return (
    <div style={S.drawer}>
      <div style={S.header}>
        <strong style={{ letterSpacing: 1 }}>CUE</strong>
        <button onClick={onClose} style={S.close} aria-label="Close">×</button>
      </div>
      <div style={S.pickerRow}>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={S.select}>
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name || ev.client || 'Untitled'}{ev.date ? ` — ${ev.date}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div ref={scrollRef} style={S.body}>
        {messages.length === 0 && (
          <div style={S.hint}>
            {eventId
              ? "Ask CUE about this event — timeline, songs, contacts, what's missing."
              : 'Pick an event above, then ask CUE about it.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? S.user : S.bot}>{m.content}</div>
        ))}
        {loading && <div style={S.bot}>…</div>}
      </div>
      <div style={S.row}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask CUE…"
          style={S.input}
        />
        <button onClick={send} disabled={loading} style={S.send}>Send</button>
      </div>
    </div>
  );
}

const S = {
  drawer: { position: 'fixed', right: 0, top: 0, height: '100%', width: 380, maxWidth: '90vw', background: '#111', color: '#eee', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,.4)', zIndex: 10000, fontFamily: 'inherit' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #333' },
  close: { background: 'none', border: 'none', color: '#eee', fontSize: 22, lineHeight: 1, cursor: 'pointer' },
  pickerRow: { padding: '10px 12px', borderBottom: '1px solid #333' },
  select: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#000', color: '#eee', fontSize: 13 },
  body: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { color: '#888', fontSize: 14, lineHeight: 1.5 },
  user: { alignSelf: 'flex-end', background: '#2a7', color: '#fff', padding: '8px 12px', borderRadius: 12, maxWidth: '85%', whiteSpace: 'pre-wrap' },
  bot: { alignSelf: 'flex-start', background: '#222', padding: '8px 12px', borderRadius: 12, maxWidth: '85%', whiteSpace: 'pre-wrap' },
  row: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #333' },
  input: { flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid #333', background: '#000', color: '#eee', fontSize: 14 },
  send: { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2a7', color: '#fff', cursor: 'pointer', fontWeight: 600 },
};

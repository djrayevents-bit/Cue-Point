import { useState, useRef, useEffect } from 'react';
import { BRAND_ACCENT, BRAND_FONT, BRAND_GRADIENT, BRAND_INK, BRAND_RADIUS, LIGHT_THEME } from '../brand';
import { enrichEventForCue, eventClientName, sanitizeCueHistory, buildBusinessContextSnapshot } from '../cueContext';
import { callCueChat, parseCueResponse } from '../cueActions';
import CueActionPreview from './CueActionPreview';
import TimelineImportModal from './TimelineImportModal';

const C = LIGHT_THEME;

const CueSparkIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2.5l1.2 4.8L18 8.5l-4.8 1.2L12 14.5l-1.2-4.8L6 8.5l4.8-1.2L12 2.5zM18.5 14l.7 2.8 2.8.7-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8 2.8-.7-2.8-.7z"
      fill={color}
    />
  </svg>
);

const INTENT_CHIPS = [
  { id: 'timeline', label: 'Timeline', prompt: 'Generate a full run-of-show timeline for this event.' },
  { id: 'mc_scripts', label: 'MC scripts', prompt: 'Write MC announcement scripts for the key moments of this event.' },
  { id: 'night_brief', label: 'Night brief', prompt: 'Summarize the questionnaire into a concise night-of brief.' },
];

const DAYOF_CHIPS = [
  {
    id: 'dayof_next',
    label: "What's next",
    prompt: "What's next on the run of show right now? List Now, Next, and Coming up from the real timeline.",
    auto: true,
  },
  {
    id: 'dayof_mc',
    label: 'MC now',
    prompt: 'Give me the MC line for the current (or next) moment. Prefer saved scripts; draft one if missing.',
    auto: true,
  },
  {
    id: 'dayof_replan',
    label: 'Replan night',
    prompt: null,
    auto: false,
    seedAssistant: 'What slipped? Examples: “dinner 40 minutes late”, “ceremony ended early”, “skip bouquet toss”. I’ll propose updated REMAINING moments — past stays locked until you confirm Apply.',
  },
];

/**
 * CUE drawer with Wave 1 apply actions (preview → confirm → write via onApplyAction).
 */
export default function CueAssistant({
  open,
  onClose,
  defaultEventId = '',
  initialIntent = '',
  dayOfMode = false,
  events: eventsProp = [],
  invoices: invoicesProp = [],
  businessSnapshotArgs = null,
  timelines = {},
  announcementScripts = {},
  questionnaireAnswers = {},
  pricingPackages = [],
  addOns = [],
  onApplyAction,
  onToast,
}) {
  const [eventId, setEventId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState([]);
  const [writeMode, setWriteMode] = useState('replace');
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState('pdf');
  const [isDayOf, setIsDayOf] = useState(false);
  const scrollRef = useRef(null);
  const bootIntentRef = useRef('');
  const stickyIntentRef = useRef('');

  const events = Array.isArray(eventsProp) ? eventsProp : [];
  const invoices = Array.isArray(invoicesProp) ? invoicesProp : [];

  useEffect(() => {
    if (!open) return;
    const initial = defaultEventId != null && defaultEventId !== '' ? String(defaultEventId) : '';
    setEventId(initial);
    setMessages([]);
    setInput('');
    setPendingActions([]);
    setWriteMode('replace');
    setShowImport(false);
    setImportTab('pdf');
    const dayof = !!(dayOfMode || String(initialIntent || '').startsWith('dayof_'));
    setIsDayOf(dayof);
    bootIntentRef.current = initialIntent || '';
    stickyIntentRef.current = '';
  }, [open, defaultEventId, initialIntent, dayOfMode]);

  useEffect(() => {
    if (!open || !bootIntentRef.current) return;
    if (bootIntentRef.current === 'import_timeline') {
      bootIntentRef.current = '';
      if (eventId) {
        setImportTab('pdf');
        setShowImport(true);
      }
      return;
    }
    const dayChip = DAYOF_CHIPS.find((c) => c.id === bootIntentRef.current);
    if (dayChip) {
      const id = bootIntentRef.current;
      bootIntentRef.current = '';
      setIsDayOf(true);
      if (dayChip.auto && dayChip.prompt) {
        send(dayChip.prompt, id);
      } else if (dayChip.seedAssistant) {
        stickyIntentRef.current = id;
        setWriteMode(id === 'dayof_replan' ? 'replace_remaining' : 'replace');
        setMessages([{ role: 'assistant', content: dayChip.seedAssistant }]);
      }
      return;
    }
    const chip = INTENT_CHIPS.find((c) => c.id === bootIntentRef.current);
    if (chip) {
      bootIntentRef.current = '';
      send(chip.prompt, chip.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, pendingActions]);

  const handleEventChange = (nextId) => {
    setEventId(nextId);
    setMessages([]);
    setInput('');
    setPendingActions([]);
  };

  async function send(textOverride, intentOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    if (!textOverride) setInput('');
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setLoading(true);
    setPendingActions([]);
    try {
      const hasEvent = !!(eventId && String(eventId).trim());
      const ev = hasEvent ? (events || []).find((e) => String(e.id) === String(eventId)) : null;
      let intent = intentOverride || 'chat';
      if (!intentOverride && stickyIntentRef.current) {
        intent = stickyIntentRef.current;
        stickyIntentRef.current = '';
      }
      const qAnswers = hasEvent ? (questionnaireAnswers?.[eventId] || null) : null;
      const nowIso = new Date().toISOString();
      const isDayIntent = String(intent).startsWith('dayof_');

      const body = {
        message: text,
        intent,
        history: sanitizeCueHistory(messages),
        packages: pricingPackages,
        addOns,
        questionnaireAnswers: intent === 'night_brief' ? qAnswers : undefined,
        nowIso: isDayIntent || isDayOf ? nowIso : undefined,
      };

      const eventScoped = hasEvent
        || intent === 'timeline'
        || intent === 'mc_scripts'
        || intent === 'night_brief'
        || isDayIntent;

      if (eventScoped) {
        body.scope = 'event';
        body.eventId = eventId || null;
        body.event = enrichEventForCue(ev, invoices);
        if (ev && timelines?.[ev.id]) {
          body.event = { ...body.event, _timeline: timelines[ev.id] };
        }
        if (ev && announcementScripts?.[ev.id]) {
          body.event = { ...body.event, _announcementScripts: announcementScripts[ev.id] };
        }
        if (ev?.nightOfBrief) {
          body.event = { ...body.event, nightOfBrief: ev.nightOfBrief };
        }
      } else {
        body.scope = 'business';
        body.eventId = null;
        body.event = null;
        body.businessContext = buildBusinessContextSnapshot({
          ...(businessSnapshotArgs || {}),
          events,
          invoices,
          focusedEventId: '',
        });
      }

      if (intent === 'chat' && !hasEvent) {
        body.scope = 'business';
        body.businessContext = buildBusinessContextSnapshot({
          ...(businessSnapshotArgs || {}),
          events,
          invoices,
          focusedEventId: '',
        });
      }

      const data = await callCueChat(body);
      const timelineItems = hasEvent ? (timelines?.[eventId] || []) : [];
      const parsed = parseCueResponse(data, { packages: pricingPackages, timelineItems });
      setMessages([...nextHistory, { role: 'assistant', content: parsed.reply || '...' }]);
      setPendingActions(parsed.actions || []);
      const hasReplan = (parsed.actions || []).some(
        (a) => a.type === 'apply_timeline' && (a.strategy === 'replace_remaining' || intent === 'dayof_replan')
      );
      setWriteMode(hasReplan ? 'replace_remaining' : 'replace');
    } catch {
      setMessages([...nextHistory, { role: 'assistant', content: 'CUE hit an error. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selectedEvent = events.find((e) => String(e.id) === String(eventId));
  const selectedLabel = selectedEvent
    ? (selectedEvent.name || eventClientName(selectedEvent) || 'this event')
    : null;

  const existingFor = (type) => {
    if (!eventId) return 0;
    if (type === 'apply_timeline') return (timelines?.[eventId] || []).length;
    if (type === 'apply_mc_scripts') return (announcementScripts?.[eventId] || []).length;
    if (type === 'save_night_brief') return selectedEvent?.nightOfBrief ? 1 : 0;
    return 0;
  };

  const chips = isDayOf ? DAYOF_CHIPS : INTENT_CHIPS;

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
              <div style={S.headerTitle}>{isDayOf ? 'CUE · Day-of' : 'CUE Assistant'}</div>
              <div style={S.headerStatus}>
                <span style={S.statusDot} />
                {loading ? 'Thinking…' : (isDayOf ? 'Booth-ready' : 'Ready to help')}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={S.close} aria-label="Close">×</button>
        </div>

        {events.length > 0 && (
          <div style={S.eventRow}>
            <select value={eventId} onChange={(e) => handleEventChange(e.target.value)} style={S.eventSelect} disabled={isDayOf && !!defaultEventId}>
              {!isDayOf && <option value="">All events</option>}
              {events.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  {ev.name || eventClientName(ev) || 'Untitled'}{ev.date ? ` — ${ev.date}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {eventId && (
          <div style={S.chips}>
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  if (c.auto && c.prompt) send(c.prompt, c.id);
                  else if (c.seedAssistant) {
                    stickyIntentRef.current = c.id;
                    setWriteMode(c.id === 'dayof_replan' ? 'replace_remaining' : 'replace');
                    setMessages([{ role: 'assistant', content: c.seedAssistant }]);
                    setPendingActions([]);
                  }
                }}
                style={S.chip}
              >
                {c.label}
              </button>
            ))}
            {!isDayOf && (
              <>
                <button type="button" disabled={loading} onClick={() => { setImportTab('pdf'); setShowImport(true); }} style={S.chip}>
                  Upload PDF
                </button>
                <button type="button" disabled={loading} onClick={() => { setImportTab('paste'); setShowImport(true); }} style={S.chip}>
                  Paste timeline
                </button>
              </>
            )}
          </div>
        )}

        <div ref={scrollRef} style={S.body}>
          {messages.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}><CueSparkIcon size={22} color={BRAND_ACCENT} /></div>
              <div style={S.emptyTitle}>{isDayOf ? 'Day-of brain' : 'Ask CUE anything'}</div>
              <div style={S.emptySub}>
                {isDayOf
                  ? (selectedLabel
                    ? `Locked on ${selectedLabel} — What's next, MC now, or replan the remaining night.`
                    : 'Pick an event for day-of help.')
                  : (selectedLabel
                    ? `Focused on ${selectedLabel} — timeline, MC scripts, night brief, or import a planner PDF.`
                    : 'Looking across your business. Pick an event to generate timeline / scripts / brief.')}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? S.user : S.bot}>{m.content}</div>
            ))
          )}
          {loading && messages.length > 0 && <div style={S.bot}>…</div>}

          {pendingActions.map((action, idx) => (
            <CueActionPreview
              key={`${action.type}-${idx}`}
              action={action}
              existingCount={existingFor(action.type)}
              writeMode={writeMode}
              onWriteModeChange={setWriteMode}
              dayOfReplan={isDayOf || action.strategy === 'replace_remaining'}
              onDismiss={() => setPendingActions((prev) => prev.filter((_, i) => i !== idx))}
              onConfirm={(meta) => {
                const result = onApplyAction?.(action, {
                  ...(meta || {}),
                  mode: writeMode,
                  eventId,
                  nowIso: new Date().toISOString(),
                });
                if (result !== false) {
                  setPendingActions((prev) => prev.filter((_, i) => i !== idx));
                  onToast?.(
                    action.type === 'apply_timeline'
                      ? (writeMode === 'replace_remaining' ? 'Remaining timeline updated' : 'Timeline applied')
                      : action.type === 'apply_mc_scripts' ? 'MC scripts applied'
                        : action.type === 'save_night_brief' ? 'Night-of brief saved'
                          : 'Applied'
                  );
                }
              }}
            />
          ))}
        </div>

        <div style={S.footer}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={isDayOf ? 'e.g. dinner 40 min late…' : 'Ask CUE anything…'}
            style={S.input}
          />
          <button type="button" onClick={() => send()} disabled={loading || !input.trim()} style={S.send} aria-label="Send">
            →
          </button>
        </div>
      </div>

      {showImport && selectedEvent && (
        <TimelineImportModal
          event={selectedEvent}
          existingCount={(timelines?.[eventId] || []).length}
          initialTab={importTab}
          onClose={() => setShowImport(false)}
          onToast={onToast}
          onApply={({ items, mode }) => {
            const action = {
              type: 'apply_timeline',
              payload: { items },
              normalized: items,
            };
            return onApplyAction?.(action, { mode: mode || 'replace', eventId }) !== false;
          }}
          onRequestMcScripts={() => {
            setShowImport(false);
            const chip = INTENT_CHIPS.find((c) => c.id === 'mc_scripts');
            if (chip) send(chip.prompt, 'mc_scripts');
          }}
        />
      )}
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
  chips: {
    display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`, background: C.bg,
  },
  chip: {
    border: `1px solid ${C.border}`, background: C.surface, borderRadius: 999, padding: '6px 10px',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: BRAND_FONT, color: C.accent,
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

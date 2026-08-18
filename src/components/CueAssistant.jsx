import { useState, useRef, useEffect } from 'react';
import { BRAND_ACCENT, BRAND_FONT, BRAND_GRADIENT, BRAND_INK, BRAND_RADIUS, LIGHT_THEME } from '../brand';
import {
  CUE_WELCOME,
  PROMPT_CATEGORIES,
  QUICK_PROMPTS,
  QUICK_START_CHIPS,
  SUGGESTED_FOLLOWUPS,
} from '../cuePrompts';
import { enrichEventForCue, eventClientName, sanitizeCueHistory, buildBusinessContextSnapshot, resolveQuestionnaireForCue, EVENT_SCOPED_CUE_INTENTS } from '../cueContext';
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

const formatMsg = (text) => text.split('\n').map((line, i) => {
  if (line.startsWith('# ')) return <div key={i} style={{ fontWeight: 900, fontSize: 15, marginBottom: 6, marginTop: i > 0 ? 10 : 0 }}>{line.slice(2)}</div>;
  if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, marginTop: i > 0 ? 8 : 0, color: C.accent }}>{line.slice(3)}</div>;
  if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, marginBottom: 4 }}>{line.slice(2, -2)}</div>;
  if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: C.accent, flexShrink: 0 }}>•</span><span>{line.slice(2)}</span></div>;
  if (line.match(/^\d+\./)) return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: C.accent, fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+/)[0]}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>;
  if (line === '') return <div key={i} style={{ height: 6 }} />;
  return <div key={i} style={{ marginBottom: 3, lineHeight: 1.55 }}>{line}</div>;
});

/**
 * Unified CUE drawer — business chat + prompt library + event apply actions.
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
  questionnaireInstances = [],
  customQuestionnaires = [],
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
  const [activeCategory, setActiveCategory] = useState('All');
  const [showPromptLibrary, setShowPromptLibrary] = useState(true);
  const [lastCategory, setLastCategory] = useState(null);
  const scrollRef = useRef(null);
  const bootIntentRef = useRef('');
  const stickyIntentRef = useRef('');

  const events = Array.isArray(eventsProp) ? eventsProp : [];
  const invoices = Array.isArray(invoicesProp) ? invoicesProp : [];
  const filteredPrompts = activeCategory === 'All'
    ? QUICK_PROMPTS
    : QUICK_PROMPTS.filter((p) => p.category === activeCategory);
  const categoryFollowups = lastCategory && SUGGESTED_FOLLOWUPS[lastCategory]
    ? SUGGESTED_FOLLOWUPS[lastCategory]
    : [];

  const resetChat = (withWelcome = true) => {
    setMessages(withWelcome ? [{ role: 'assistant', content: CUE_WELCOME }] : []);
    setInput('');
    setPendingActions([]);
    setLastCategory(null);
    setShowPromptLibrary(withWelcome);
    setActiveCategory('All');
  };

  useEffect(() => {
    if (!open) return;
    const initial = defaultEventId != null && defaultEventId !== '' ? String(defaultEventId) : '';
    setEventId(initial);
    setWriteMode('replace');
    setShowImport(false);
    setImportTab('pdf');
    const dayof = !!(dayOfMode || String(initialIntent || '').startsWith('dayof_'));
    setIsDayOf(dayof);
    bootIntentRef.current = initialIntent || '';
    stickyIntentRef.current = '';
    const hasBootIntent = !!(initialIntent || '');
    resetChat(!dayof && !hasBootIntent);
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
      const resolvedId = eventId || (defaultEventId != null && defaultEventId !== '' ? String(defaultEventId) : '');
      if (dayChip.auto && dayChip.prompt && !resolvedId) return;
      bootIntentRef.current = '';
      setIsDayOf(true);
      setShowPromptLibrary(false);
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
      const resolvedId = eventId || (defaultEventId != null && defaultEventId !== '' ? String(defaultEventId) : '');
      if (EVENT_SCOPED_CUE_INTENTS.has(chip.id) && !resolvedId) return;
      bootIntentRef.current = '';
      setShowPromptLibrary(false);
      send(chip.prompt, chip.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId, defaultEventId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, pendingActions, showPromptLibrary]);

  const handleEventChange = (nextId) => {
    setEventId(nextId);
    if (!isDayOf) resetChat(true);
    else {
      setMessages([]);
      setInput('');
      setPendingActions([]);
    }
  };

  async function send(textOverride, intentOverride, opts = {}) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    const { category, forceBusiness } = opts;
    if (!textOverride) setInput('');
    if (category) setLastCategory(category);
    setShowPromptLibrary(false);
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setLoading(true);
    setPendingActions([]);
    try {
      const resolvedEventId = (eventId && String(eventId).trim())
        || (defaultEventId != null && defaultEventId !== '' ? String(defaultEventId) : '');
      const hasEvent = !!resolvedEventId;
      const ev = hasEvent ? (events || []).find((e) => String(e.id) === resolvedEventId) : null;
      let intent = intentOverride || 'chat';
      if (!intentOverride && stickyIntentRef.current) {
        intent = stickyIntentRef.current;
        stickyIntentRef.current = '';
      }
      const inst = hasEvent
        ? (questionnaireInstances || []).find((q) => String(q.eventId) === resolvedEventId)
        : null;
      const tplId = inst?.templateId
        || questionnaireAnswers?.[resolvedEventId]?.__templateId
        || questionnaireAnswers?.[ev?.id]?.__templateId;
      const tpl = (customQuestionnaires || []).find((t) => String(t.id) === String(tplId));
      const qAnswers = hasEvent
        ? resolveQuestionnaireForCue(
          resolvedEventId,
          questionnaireAnswers,
          questionnaireInstances,
          inst?.questions?.length ? inst.questions : (tpl?.questions || []),
        )
        : null;
      const nowIso = new Date().toISOString();
      const isDayIntent = String(intent).startsWith('dayof_');
      const isEventIntent = EVENT_SCOPED_CUE_INTENTS.has(intent) || isDayIntent;
      const useBusinessScope = !!(forceBusiness || category || (intent === 'chat' && !isEventIntent));

      const body = {
        message: text,
        intent,
        history: sanitizeCueHistory(messages),
        packages: pricingPackages,
        addOns,
        questionnaireAnswers: intent === 'night_brief' ? qAnswers : undefined,
        nowIso: isDayIntent || isDayOf ? nowIso : undefined,
      };

      if (useBusinessScope) {
        body.scope = 'business';
        body.eventId = resolvedEventId || null;
        body.event = hasEvent ? enrichEventForCue(ev, invoices) : null;
        body.businessContext = buildBusinessContextSnapshot({
          ...(businessSnapshotArgs || {}),
          events,
          invoices,
          focusedEventId: resolvedEventId || '',
        });
      } else {
        body.scope = 'event';
        body.eventId = resolvedEventId || null;
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
      }

      const data = await callCueChat(body);
      const timelineItems = hasEvent ? (timelines?.[resolvedEventId] || timelines?.[ev?.id] || []) : [];
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

  const copyText = (text) => {
    navigator.clipboard?.writeText(text);
    onToast?.('Copied');
  };

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
  const hasUserMessages = messages.some((m) => m.role === 'user');

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
              <div style={S.headerTitle}>{isDayOf ? 'CUE · Day-of' : 'CUE'}</div>
              <div style={S.headerStatus}>
                <span style={S.statusDot} />
                {loading ? 'Thinking…' : (isDayOf ? 'Booth-ready' : 'Knows your events, clients & financials')}
              </div>
            </div>
          </div>
          <div style={S.headerActions}>
            {!isDayOf && hasUserMessages && (
              <button type="button" onClick={() => resetChat(true)} style={S.headerBtn}>Clear</button>
            )}
            {!isDayOf && (
              <button
                type="button"
                onClick={() => setShowPromptLibrary((v) => !v)}
                style={{ ...S.headerBtn, ...(showPromptLibrary ? S.headerBtnActive : {}) }}
              >
                Prompts
              </button>
            )}
            <button type="button" onClick={onClose} style={S.close} aria-label="Close">×</button>
          </div>
        </div>

        {events.length > 0 && (
          <div style={S.eventRow}>
            <select value={eventId} onChange={(e) => handleEventChange(e.target.value)} style={S.eventSelect} disabled={isDayOf && !!defaultEventId}>
              {!isDayOf && <option value="">All events (business chat)</option>}
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
                  setShowPromptLibrary(false);
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
          {messages.map((m, i) => (
            <div key={i} style={m.role === 'user' ? S.userWrap : S.botWrap}>
              <div style={m.role === 'user' ? S.user : S.bot}>
                {m.role === 'assistant' ? formatMsg(m.content) : m.content}
              </div>
              {m.role === 'assistant' && i > 0 && !loading && (
                <div style={S.msgActions}>
                  <button type="button" style={S.msgAction} onClick={() => copyText(m.content)}>Copy</button>
                  <button type="button" style={S.msgAction} onClick={() => send('Can you refine this to be more concise?', 'chat', { forceBusiness: true })}>Shorter</button>
                  <button type="button" style={S.msgAction} onClick={() => send('Can you make this more detailed and elaborate?', 'chat', { forceBusiness: true })}>Longer</button>
                  <button type="button" style={S.msgAction} onClick={() => send('Can you make this more professional and formal?', 'chat', { forceBusiness: true })}>More formal</button>
                </div>
              )}
            </div>
          ))}

          {loading && <div style={S.botWrap}><div style={S.bot}>…</div></div>}

          {!isDayOf && showPromptLibrary && !loading && (
            <div style={S.promptLibrary}>
              {!hasUserMessages && (
                <div style={S.quickChips}>
                  {QUICK_START_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      style={S.quickChip}
                      onClick={() => send(chip, 'chat', { forceBusiness: true })}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              <div style={S.categoryRow}>
                {PROMPT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      ...S.categoryPill,
                      ...(activeCategory === cat ? S.categoryPillActive : {}),
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div style={S.promptList}>
                {filteredPrompts.map((p) => (
                  <button
                    key={`${p.category}-${p.label}`}
                    type="button"
                    style={S.promptCard}
                    onClick={() => send(p.prompt, 'chat', { category: p.category, forceBusiness: true })}
                  >
                    <div style={S.promptLabel}>{p.label}</div>
                    <div style={S.promptCategory}>{p.category}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {categoryFollowups.length > 0 && !loading && !showPromptLibrary && (
            <div style={S.followups}>
              {categoryFollowups.map((f) => (
                <button key={f} type="button" style={S.followupChip} onClick={() => send(f, 'chat', { forceBusiness: true, category: lastCategory })}>
                  {f}
                </button>
              ))}
            </div>
          )}

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
            placeholder={
              isDayOf
                ? 'e.g. dinner 40 min late…'
                : (eventId
                  ? 'Ask about this event or your business…'
                  : 'Draft an email, plan a setlist, ask about your business…')
            }
            style={S.input}
          />
          <button type="button" onClick={() => send()} disabled={loading || !input.trim()} style={S.send} aria-label="Send">
            →
          </button>
        </div>
        <div style={S.disclaimer}>AI responses are suggestions — review before sending to clients</div>
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
    position: 'fixed', right: 16, top: 16, bottom: 16, width: 420, maxWidth: 'calc(100vw - 32px)',
    background: C.surface, borderRadius: BRAND_RADIUS.card, display: 'flex', flexDirection: 'column',
    boxShadow: '0 12px 48px rgba(22, 22, 26, 0.14)', zIndex: 9999, fontFamily: BRAND_FONT,
    border: `1px solid ${C.border}`, overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: C.bg, borderBottom: `1px solid ${C.border}`,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10, background: BRAND_GRADIENT,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 15, color: BRAND_INK, letterSpacing: '-0.02em' },
  headerStatus: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: C.green, flexShrink: 0 },
  headerBtn: {
    background: C.surface, border: `1px solid ${C.border}`, color: C.muted,
    fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '5px 10px',
    borderRadius: 8, fontFamily: BRAND_FONT,
  },
  headerBtnActive: {
    color: C.accent, borderColor: `${C.accent}55`, background: `${C.accent}10`,
  },
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
    flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column',
    gap: 10, background: C.surface,
  },
  userWrap: { alignSelf: 'flex-end', maxWidth: '92%' },
  botWrap: { alignSelf: 'flex-start', maxWidth: '92%' },
  user: {
    background: BRAND_GRADIENT, color: '#fff',
    padding: '10px 14px', borderRadius: '16px 4px 16px 16px',
    whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5,
  },
  bot: {
    background: C.bg, border: `1px solid ${C.border}`,
    padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
    whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: BRAND_INK,
  },
  msgActions: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  msgAction: {
    border: `1px solid ${C.border}`, background: C.surface, borderRadius: 6,
    padding: '3px 8px', fontSize: 10, fontWeight: 600, color: C.muted,
    cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  promptLibrary: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  quickChips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    border: `1px solid ${C.border}`, background: C.bg, borderRadius: 999,
    padding: '6px 10px', fontSize: 11, color: C.muted, cursor: 'pointer',
    fontFamily: BRAND_FONT, textAlign: 'left',
  },
  categoryRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  categoryPill: {
    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', fontFamily: BRAND_FONT, border: `1px solid ${C.border}`,
    background: C.bg, color: C.muted,
  },
  categoryPillActive: {
    background: `${C.accent}15`, color: C.accent, borderColor: `${C.accent}55`,
  },
  promptList: { display: 'flex', flexDirection: 'column', gap: 6 },
  promptCard: {
    textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    background: C.bg, border: `1px solid ${C.border}`, fontFamily: BRAND_FONT,
  },
  promptLabel: { fontSize: 12, fontWeight: 700, color: BRAND_INK, marginBottom: 2 },
  promptCategory: { fontSize: 10, color: C.muted },
  followups: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  followupChip: {
    border: `1px solid ${C.border}`, background: C.bg, borderRadius: 999,
    padding: '5px 10px', fontSize: 10, fontWeight: 600, color: C.accent,
    cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 6px',
    borderTop: `1px solid ${C.border}`, background: C.bg,
  },
  input: {
    flex: 1, padding: '12px 16px', borderRadius: BRAND_RADIUS.pill,
    border: `1px solid ${C.border}`, background: C.surface, color: BRAND_INK,
    fontSize: 13, fontFamily: BRAND_FONT, outline: 'none',
  },
  send: {
    width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
    background: BRAND_ACCENT, color: '#fff', cursor: 'pointer', fontSize: 18,
    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(108, 77, 246, 0.35)',
  },
  disclaimer: {
    fontSize: 10, color: C.muted, textAlign: 'center', padding: '0 14px 10px',
    background: C.bg, fontFamily: BRAND_FONT,
  },
};

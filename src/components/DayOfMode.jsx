import { useEffect, useMemo, useState } from 'react';
import { BRAND_FONT, LIGHT_THEME, BRAND_GRADIENT, BRAND_ACCENT } from '../brand';
import { formatNow } from '../timeFormat';
import {
  pickTodayOrNextEvent,
  getTimelinePosition,
  countdownTo,
  findScriptForMoment,
} from '../dayOfHelpers';

const C = LIGHT_THEME;

/**
 * Live Day-of Mode shell — run of show, MC teleprompter, night brief, CUE chips.
 * Writes go through onOpenCue → CueAssistant preview/confirm (never silent).
 */
export default function DayOfMode({
  events = [],
  timelines = {},
  announcementScripts = {},
  timeFormat,
  onOpenCue,
  setSection,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [prompterIdx, setPrompterIdx] = useState(0);
  const [largeType, setLargeType] = useState(true);
  const [showBrief, setShowBrief] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const pick = pickTodayOrNextEvent(events);
    setSelectedId((prev) => {
      if (prev != null && events.some((e) => String(e.id) === String(prev))) return prev;
      return pick?.id ?? events[0]?.id ?? null;
    });
  }, [events]);

  const ev = events.find((e) => String(e.id) === String(selectedId)) || null;
  const timeline = (ev?.id && timelines[ev.id]) ? timelines[ev.id] : [];
  const scripts = (ev?.id && announcementScripts[ev.id]) ? announcementScripts[ev.id] : [];
  const pos = useMemo(() => getTimelinePosition(timeline, now), [timeline, now]);
  const countdown = countdownTo(pos.next, now);

  const momentForMc = pos.current || pos.next;
  const matchedScript = findScriptForMoment(scripts, momentForMc);

  useEffect(() => {
    if (!scripts.length || !matchedScript) return;
    const idx = scripts.findIndex((s) => s.id === matchedScript.id || s.label === matchedScript.label);
    if (idx >= 0) setPrompterIdx(idx);
  }, [ev?.id, matchedScript?.label, matchedScript?.id, scripts]);

  const openCue = (intent) => {
    if (!ev?.id) return;
    onOpenCue?.(ev.id, { intent, dayOf: true });
  };

  const timeStr = formatNow(now, timeFormat, { seconds: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!events.length) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No events yet</div>
        <div style={{ color: C.muted, marginBottom: 16 }}>Create an event to use Day-of Mode.</div>
        {setSection && (
          <button type="button" style={S.primaryBtn} onClick={() => setSection('events')}>Go to Events</button>
        )}
      </div>
    );
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={S.liveDot} />
          <span style={S.liveLabel}>Day-of Mode</span>
          <span style={{ fontSize: 12, color: C.muted }}>{dateStr}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            style={S.select}
            aria-label="Select event"
          >
            {events
              .slice()
              .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.date || 'TBD'} — {e.name || 'Untitled'}
                </option>
              ))}
          </select>
          <button type="button" style={S.ghostBtn} onClick={() => setLargeType((v) => !v)}>
            {largeType ? 'Normal type' : 'Large type'}
          </button>
        </div>
      </header>

      <div style={{ ...S.body, fontSize: largeType ? '112%' : '100%' }}>
        <div style={S.heroGrid}>
          <div style={S.card}>
            <div style={S.eyebrow}>Now</div>
            <div style={S.clock}>{timeStr}</div>
            <div style={{ fontSize: 13, color: C.muted }}>{dateStr}</div>
          </div>
          <div style={S.card}>
            <div style={S.eyebrow}>Tonight</div>
            <div style={S.eventName}>{ev?.name || 'Event'}</div>
            {ev?.client && <div style={S.meta}>{ev.client}</div>}
            {ev?.venue && <div style={S.meta}>{ev.venue}</div>}
            {(ev?.startTime || ev?.endTime) && (
              <div style={S.meta}>{[ev.startTime, ev.endTime].filter(Boolean).join(' – ')}</div>
            )}
          </div>
        </div>

        <div style={S.cueBar}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>CUE — day-of brain</div>
          <div style={S.chipRow}>
            <button type="button" style={S.chip} onClick={() => openCue('dayof_next')}>What's next</button>
            <button type="button" style={S.chip} onClick={() => openCue('dayof_mc')}>MC for this moment</button>
            <button type="button" style={{ ...S.chip, ...S.chipWarn }} onClick={() => openCue('dayof_replan')}>Replan night</button>
          </div>
        </div>

        {!pos.hasTimeline ? (
          <div style={S.warnBox}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>No timeline for this event</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Generate a run of show or import a planner PDF so What's next and replan stay grounded.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={S.primaryBtn} onClick={() => openCue('timeline')}>Generate timeline</button>
              <button type="button" style={S.ghostBtn} onClick={() => openCue('import_timeline')}>Import PDF / paste</button>
            </div>
          </div>
        ) : (
          <div style={S.heroGrid}>
            <div style={{ ...S.card, borderColor: BRAND_ACCENT, borderWidth: 2 }}>
              <div style={{ ...S.eyebrow, color: BRAND_ACCENT }}>Playing now</div>
              {pos.current ? (
                <>
                  <div style={S.momentTitle}>{pos.current.label}</div>
                  {pos.current.time && <div style={S.meta}>Started {pos.current.time}</div>}
                  {pos.current.song && <div style={{ ...S.meta, color: C.purple }}>Cue: {pos.current.song}</div>}
                  {pos.current.note && <div style={{ ...S.meta, marginTop: 8 }}>{pos.current.note}</div>}
                </>
              ) : (
                <div style={S.meta}>Before first timed moment{pos.next ? ` — up next ${pos.next.label}` : ''}</div>
              )}
            </div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={S.eyebrow}>Up next</div>
                {countdown && <span style={S.countdown}>{countdown}</span>}
              </div>
              {pos.next ? (
                <>
                  <div style={S.momentTitle}>{pos.next.label}</div>
                  {pos.next.time && <div style={S.meta}>Starts {pos.next.time}</div>}
                  {pos.next.song && <div style={{ ...S.meta, color: C.purple }}>Cue: {pos.next.song}</div>}
                  {pos.next.note && <div style={{ ...S.meta, marginTop: 8 }}>{pos.next.note}</div>}
                </>
              ) : (
                <div style={S.meta}>No more timed moments</div>
              )}
            </div>
          </div>
        )}

        {pos.comingUp.length > 0 && (
          <div style={S.card}>
            <div style={S.eyebrow}>Coming up</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pos.comingUp.map((it) => (
                <div key={it.id || it._i} style={S.comingRow}>
                  <span style={S.time}>{it.time || '—'}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{it.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={S.eyebrow}>MC teleprompter</div>
            <button type="button" style={S.ghostBtn} onClick={() => openCue('dayof_mc')}>
              MC for this moment
            </button>
          </div>
          {scripts.length === 0 ? (
            <div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                No saved MC scripts yet{momentForMc ? ` for “${momentForMc.label}”` : ''}. Generate one with CUE, or write them in Planning.
              </div>
              <button type="button" style={S.primaryBtn} onClick={() => openCue('dayof_mc')}>Generate MC line</button>
            </div>
          ) : (
            <>
              <div style={S.scriptTabs}>
                {scripts.map((s, i) => (
                  <button
                    key={s.id || i}
                    type="button"
                    onClick={() => setPrompterIdx(i)}
                    style={{ ...S.tab, ...(prompterIdx === i ? S.tabOn : {}) }}
                  >
                    {s.label || `Script ${i + 1}`}
                  </button>
                ))}
              </div>
              <div style={S.teleprompter}>
                {scripts[prompterIdx]?.text || '—'}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <button type="button" style={S.ghostBtn} disabled={prompterIdx <= 0} onClick={() => setPrompterIdx((i) => Math.max(0, i - 1))}>← Prev</button>
                <button type="button" style={S.ghostBtn} disabled={prompterIdx >= scripts.length - 1} onClick={() => setPrompterIdx((i) => Math.min(scripts.length - 1, i + 1))}>Next →</button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{prompterIdx + 1} / {scripts.length}</span>
              </div>
            </>
          )}
        </div>

        {ev?.nightOfBrief && (
          <div style={S.card}>
            <button type="button" onClick={() => setShowBrief((v) => !v)} style={{ ...S.eyebrow, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.accent }}>
              Night-of brief {showBrief ? '▾' : '▸'}
            </button>
            {showBrief && (
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: C.text }}>
                {ev.nightOfBrief}
              </div>
            )}
          </div>
        )}

        {pos.hasTimeline && (
          <div style={S.card}>
            <div style={S.eyebrow}>Full run of show</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {timeline.map((it, i) => {
                const label = it.event || it.label || 'Moment';
                const isCurrent = pos.current && (pos.current.id === it.id || pos.current.label === label);
                const isNext = pos.next && !isCurrent && (pos.next.id === it.id || pos.next.label === label);
                return (
                  <div
                    key={it.id || i}
                    style={{
                      ...S.tlRow,
                      ...(isCurrent ? S.tlCurrent : {}),
                      ...(isNext ? S.tlNext : {}),
                    }}
                  >
                    <span style={S.time}>{it.time || '—'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: isCurrent || isNext ? 800 : 600 }}>{label}</div>
                      {it.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{it.note}</div>}
                      {isCurrent && <div style={{ fontSize: 10, fontWeight: 800, color: BRAND_ACCENT, marginTop: 4 }}>NOW</div>}
                      {isNext && <div style={{ fontSize: 10, fontWeight: 800, color: C.orange, marginTop: 4 }}>NEXT</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    fontFamily: BRAND_FONT, color: C.text, margin: '-24px', minHeight: '100vh', background: C.bg,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '14px 18px', background: C.surface, borderBottom: `1px solid ${C.border}`,
    position: 'sticky', top: 0, zIndex: 5,
  },
  liveDot: {
    width: 10, height: 10, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`,
  },
  liveLabel: {
    fontSize: 12, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  body: {
    padding: '18px 16px 40px', maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14,
  },
  heroGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12,
  },
  card: {
    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 18px',
  },
  eyebrow: {
    fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
  },
  clock: {
    fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginBottom: 6,
  },
  eventName: { fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 },
  momentTitle: { fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6, lineHeight: 1.2 },
  meta: { fontSize: 13, color: C.muted, lineHeight: 1.45 },
  cueBar: {
    background: BRAND_GRADIENT, borderRadius: 16, padding: '16px 16px', color: '#fff',
  },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.18)', color: '#fff',
    borderRadius: 12, padding: '12px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
    fontFamily: BRAND_FONT, minHeight: 44,
  },
  chipWarn: { background: 'rgba(0,0,0,0.18)' },
  primaryBtn: {
    background: BRAND_ACCENT, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px',
    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT, minHeight: 44,
  },
  ghostBtn: {
    background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: BRAND_FONT, minHeight: 40,
  },
  select: {
    fontSize: 13, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.surfaceAlt, color: C.text, fontFamily: BRAND_FONT, minHeight: 40, maxWidth: '100%',
  },
  warnBox: {
    background: C.orange + '14', border: `1px solid ${C.orange}40`, borderRadius: 16, padding: 18,
  },
  countdown: {
    background: C.orange + '20', color: C.orange, border: `1px solid ${C.orange}40`,
    borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 800,
  },
  comingRow: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0',
    borderBottom: `1px solid ${C.border}`,
  },
  time: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 800,
    color: BRAND_ACCENT, width: 72, flexShrink: 0,
  },
  scriptTabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  tab: {
    border: `1px solid ${C.border}`, background: C.surface, borderRadius: 999, padding: '8px 12px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: BRAND_FONT, color: C.muted, minHeight: 36,
  },
  tabOn: { borderColor: BRAND_ACCENT, color: BRAND_ACCENT, background: BRAND_ACCENT + '14' },
  teleprompter: {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 22px',
    fontSize: 22, fontWeight: 600, lineHeight: 1.65, letterSpacing: '0.01em', minHeight: 140,
  },
  tlRow: {
    display: 'flex', gap: 12, padding: '12px 12px', borderRadius: 12, border: `1px solid ${C.border}`,
  },
  tlCurrent: { background: BRAND_ACCENT + '12', borderColor: BRAND_ACCENT + '50' },
  tlNext: { background: C.orange + '10', borderColor: C.orange + '40' },
  empty: {
    minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: BRAND_FONT, color: C.text, padding: 24, textAlign: 'center',
  },
};

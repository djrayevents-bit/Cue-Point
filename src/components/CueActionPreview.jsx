import { BRAND_FONT, LIGHT_THEME } from '../brand';
import { mailtoHref } from '../cueActions';

const C = LIGHT_THEME;

const TITLES = {
  apply_timeline: 'Apply timeline',
  apply_mc_scripts: 'Apply MC scripts',
  prefill_event: 'Prefill event',
  draft_email: 'Email draft',
  save_night_brief: 'Night-of brief',
};

/**
 * Preview → confirm card for a single CUE action.
 * mode for overwrite: 'replace' | 'merge' | 'append' (caller decides).
 */
export default function CueActionPreview({
  action,
  existingCount = 0,
  writeMode,
  onWriteModeChange,
  onConfirm,
  onDismiss,
}) {
  if (!action) return null;
  const { type, normalized } = action;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={S.title}>{TITLES[type] || type}</div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} style={S.x} aria-label="Dismiss">×</button>
        )}
      </div>

      {type === 'apply_timeline' && (
        <>
          <div style={S.meta}>{normalized.length} moment{normalized.length === 1 ? '' : 's'} proposed</div>
          <div style={S.list}>
            {normalized.slice(0, 8).map((it) => (
              <div key={it.id} style={S.row}>
                <span style={S.time}>{it.time || '—'}</span>
                <span style={{ flex: 1 }}>{it.event}</span>
              </div>
            ))}
            {normalized.length > 8 && <div style={S.meta}>+{normalized.length - 8} more</div>}
          </div>
          {existingCount > 0 && onWriteModeChange && (
            <div style={S.warn}>
              This event already has {existingCount} timeline moment{existingCount === 1 ? '' : 's'}.
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {['replace', 'merge'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onWriteModeChange(m)}
                    style={{ ...S.chip, ...(writeMode === m ? S.chipOn : {}) }}
                  >
                    {m === 'replace' ? 'Replace' : 'Merge'}
                  </button>
                ))}
              </div>
              {writeMode === 'replace' && (
                <div style={{ ...S.meta, color: C.orange, marginTop: 6 }}>Replace will overwrite the current timeline.</div>
              )}
            </div>
          )}
        </>
      )}

      {type === 'apply_mc_scripts' && (
        <>
          <div style={S.meta}>{normalized.length} script{normalized.length === 1 ? '' : 's'}</div>
          <div style={S.list}>
            {normalized.map((s) => (
              <div key={s.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: C.muted, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{s.text}</div>
              </div>
            ))}
          </div>
          {existingCount > 0 && onWriteModeChange && (
            <div style={S.warn}>
              {existingCount} script{existingCount === 1 ? '' : 's'} already saved.
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {['replace', 'merge'].map((m) => (
                  <button key={m} type="button" onClick={() => onWriteModeChange(m)} style={{ ...S.chip, ...(writeMode === m ? S.chipOn : {}) }}>
                    {m === 'replace' ? 'Replace' : 'Merge'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {type === 'prefill_event' && (
        <div style={S.list}>
          {[
            ['Name', normalized.eventName],
            ['Client', normalized.client],
            ['Date', normalized.date],
            ['Type', normalized.eventType],
            ['Venue', normalized.venueName],
            ['Time', [normalized.startTime, normalized.endTime].filter(Boolean).join(' – ')],
            ['Package', normalized.package],
            ['Fee', normalized.totalFee ? `$${normalized.totalFee}` : ''],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={S.row}><span style={S.muted}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
          ))}
        </div>
      )}

      {type === 'draft_email' && (
        <div style={S.list}>
          {normalized.to && <div style={S.row}><span style={S.muted}>To</span><span>{normalized.to}</span></div>}
          <div style={S.row}><span style={S.muted}>Subject</span><span style={{ fontWeight: 600 }}>{normalized.subject}</span></div>
          <pre style={S.pre}>{normalized.body}</pre>
        </div>
      )}

      {type === 'save_night_brief' && (
        <>
          <pre style={S.pre}>{normalized}</pre>
          {existingCount > 0 && onWriteModeChange && (
            <div style={S.warn}>
              A night-of brief already exists on this event.
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {['replace', 'append'].map((m) => (
                  <button key={m} type="button" onClick={() => onWriteModeChange(m)} style={{ ...S.chip, ...(writeMode === m ? S.chipOn : {}) }}>
                    {m === 'replace' ? 'Replace' : 'Append'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={S.actions}>
        {type === 'draft_email' ? (
          <>
            <button type="button" style={S.primary} onClick={() => {
              navigator.clipboard?.writeText(
                `To: ${normalized.to}\nSubject: ${normalized.subject}\n\n${normalized.body}`
              );
              onConfirm?.({ copied: true });
            }}>Copy</button>
            <a href={mailtoHref(normalized)} style={S.secondaryLink} onClick={() => onConfirm?.({ opened: true })}>
              Open in mail
            </a>
          </>
        ) : (
          <button type="button" style={S.primary} onClick={() => onConfirm?.({ mode: writeMode || 'replace' })}>
            {type === 'prefill_event' ? 'Apply to form' : type === 'save_night_brief' ? 'Save brief' : 'Apply'}
          </button>
        )}
        {onDismiss && (
          <button type="button" style={S.ghost} onClick={onDismiss}>Not now</button>
        )}
      </div>
    </div>
  );
}

const S = {
  card: {
    border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, background: C.bg,
    fontFamily: BRAND_FONT, marginTop: 10,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontWeight: 800, fontSize: 14, color: C.text },
  x: { background: 'none', border: 'none', fontSize: 18, color: C.muted, cursor: 'pointer', lineHeight: 1 },
  meta: { fontSize: 12, color: C.muted, marginBottom: 8 },
  list: { fontSize: 13, color: C.text, marginBottom: 10 },
  row: { display: 'flex', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}55` },
  time: { fontFamily: 'monospace', fontWeight: 700, color: C.accent, width: 72, flexShrink: 0 },
  muted: { color: C.muted, width: 72, flexShrink: 0, fontSize: 12 },
  pre: {
    whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, background: C.surface,
    border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, maxHeight: 180, overflow: 'auto',
    fontFamily: BRAND_FONT, margin: '0 0 10px',
  },
  warn: {
    background: C.orange + '12', border: `1px solid ${C.orange}40`, borderRadius: 10,
    padding: 10, fontSize: 12, color: C.text, marginBottom: 10,
  },
  chip: {
    border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '6px 10px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: BRAND_FONT, color: C.muted,
  },
  chipOn: { borderColor: C.accent, color: C.accent, background: C.accent + '15' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  primary: {
    background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  secondaryLink: {
    display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 10,
    border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', fontWeight: 700,
    fontSize: 13, fontFamily: BRAND_FONT, background: C.surface,
  },
  ghost: {
    background: 'transparent', border: 'none', color: C.muted, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: BRAND_FONT,
  },
};

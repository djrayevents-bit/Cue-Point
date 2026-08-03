import { useState, useRef } from 'react';
import { BRAND_FONT, LIGHT_THEME } from '../brand';
import { callCueImportTimeline, normalizeTimelineItems, parseCueResponse } from '../cueActions';

const C = LIGHT_THEME;

/**
 * PDF / paste → extract → review → Apply (Replace|Merge) into timelines[eventId].
 * Reuses Wave 1 apply_timeline action shape + onApply({ items, mode }).
 */
const MAX_PDF_BYTES = Math.floor(4.5 * 1024 * 1024);

export default function TimelineImportModal({
  event,
  existingCount = 0,
  initialTab = 'pdf', // pdf | paste
  onClose,
  onApply,
  onToast,
  onRequestMcScripts,
}) {
  const [tab, setTab] = useState(initialTab === 'paste' ? 'paste' : 'pdf');
  const [paste, setPaste] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [reply, setReply] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [rows, setRows] = useState(null); // null = not yet extracted
  const [writeMode, setWriteMode] = useState('replace');
  const [applied, setApplied] = useState(false);
  const fileRef = useRef(null);
  const pdfBase64Ref = useRef('');

  const readPdfFile = (file) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) {
      return reject(new Error('Only PDF files are supported'));
    }
    if (file.size > MAX_PDF_BYTES) {
      return reject(new Error('PDF too large (max 4.5MB)'));
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64: b64, name: file.name || 'timeline.pdf' });
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const onPickFile = async (file) => {
    setFileError('');
    setExtractError('');
    try {
      const { base64, name } = await readPdfFile(file);
      pdfBase64Ref.current = base64;
      setFileName(name);
    } catch (e) {
      pdfBase64Ref.current = '';
      setFileName('');
      setFileError(e.message || 'Invalid file');
    }
  };

  const runExtract = async () => {
    if (!event?.id || loading) return;
    setLoading(true);
    setExtractError('');
    setRows(null);
    setReply('');
    setWarnings([]);
    try {
      const payload = {
        eventId: event.id,
        event: {
          name: event.name,
          type: event.type || event.eventType,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
        },
      };
      if (tab === 'pdf') {
        if (!pdfBase64Ref.current) throw new Error('Choose a PDF first');
        payload.pdfBase64 = pdfBase64Ref.current;
        payload.filename = fileName;
      } else {
        if (!paste.trim()) throw new Error('Paste a timeline first');
        payload.text = paste.trim();
      }

      const data = await callCueImportTimeline(payload);
      const parsed = parseCueResponse(data);
      const action = (parsed.actions || []).find((a) => a.type === 'apply_timeline');
      const items = action?.payload?.items || action?.normalized || [];
      if (!items.length) {
        throw new Error(parsed.reply || data.error || 'No moments found');
      }
      setReply(parsed.reply || data.reply || '');
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setRows(items.map((it, i) => ({
        key: `r${i}`,
        include: it.include !== false,
        time: it.time || '',
        event: it.event || it.label || '',
        duration: it.duration != null ? String(it.duration).replace(/\s*min$/i, '') : '15',
        song: it.song || '',
        note: it.note || '',
        confidence: it.confidence,
        flags: it.flags || [],
      })));
    } catch (e) {
      setExtractError(e.message || 'Extraction failed');
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (key, patch) => {
    setRows((prev) => (prev || []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const included = (rows || []).filter((r) => r.include && r.event.trim());

  const confirmApply = () => {
    if (!included.length || !onApply) return;
    const items = included.map((r) => ({
      time: r.time,
      event: r.event.trim(),
      duration: r.duration ? Number(r.duration) || r.duration : 15,
      song: r.song || '',
      note: r.note || '',
      linkedSectionId: null,
    }));
    const ok = onApply({
      items: normalizeTimelineItems(items),
      mode: writeMode,
      source: tab === 'pdf' ? 'pdf' : 'paste',
    });
    if (ok === false) return;
    setApplied(true);
    onToast?.(writeMode === 'merge' ? 'Timeline merged from import' : 'Timeline imported');
  };

  return (
    <div style={S.backdrop} onClick={onClose} role="presentation">
      <div style={S.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Import timeline">
        <div style={S.head}>
          <div>
            <div style={S.title}>Import planner timeline</div>
            <div style={S.sub}>
              AI suggestion for {event?.name || 'this event'} — review before Apply. Nothing is written until you confirm.
            </div>
          </div>
          <button type="button" onClick={onClose} style={S.x} aria-label="Close">×</button>
        </div>

        {!rows && !applied && (
          <>
            <div style={S.tabs}>
              {[
                { id: 'pdf', label: 'Upload PDF' },
                { id: 'paste', label: 'Paste timeline' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setExtractError(''); }}
                  style={{ ...S.tab, ...(tab === t.id ? S.tabOn : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'pdf' ? (
              <div
                style={S.drop}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onPickFile(f);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                  }}
                />
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
                  {fileName || 'Drop a planner PDF here'}
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  PDF only · max 4.5MB · processed in-request, not stored
                </div>
                {fileError && <div style={S.err}>{fileError}</div>}
              </div>
            ) : (
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'Paste a run of show, e.g.\n4:00 PM  Cocktail hour\n5:00 PM  Grand entrance\n5:15 PM  First dance — Perfect by Ed Sheeran'}
                style={S.textarea}
                rows={10}
              />
            )}

            {extractError && <div style={S.errBox}>{extractError}</div>}

            <div style={S.footer}>
              <button type="button" style={S.ghost} onClick={onClose}>Cancel</button>
              <button
                type="button"
                style={S.primary}
                disabled={loading || (tab === 'pdf' ? !pdfBase64Ref.current : !paste.trim())}
                onClick={runExtract}
              >
                {loading ? 'Extracting…' : 'Extract timeline'}
              </button>
            </div>
          </>
        )}

        {loading && (
          <div style={S.loading}>Reading schedule with CUE…</div>
        )}

        {rows && !applied && (
          <>
            {reply && <div style={S.reply}>{reply}</div>}
            {warnings.length > 0 && (
              <div style={S.warn}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Needs review</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Use</th>
                    <th style={S.th}>Time</th>
                    <th style={S.th}>Moment</th>
                    <th style={S.th}>Min</th>
                    <th style={S.th}>Note / song</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} style={{ opacity: r.include ? 1 : 0.45 }}>
                      <td style={S.td}>
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => updateRow(r.key, { include: e.target.checked })}
                        />
                      </td>
                      <td style={S.td}>
                        <input
                          value={r.time}
                          onChange={(e) => updateRow(r.key, { time: e.target.value })}
                          style={S.inputSm}
                          placeholder="4:00 PM"
                        />
                      </td>
                      <td style={S.td}>
                        <input
                          value={r.event}
                          onChange={(e) => updateRow(r.key, { event: e.target.value })}
                          style={{ ...S.inputSm, minWidth: 140 }}
                        />
                        {(r.flags || []).includes('low_confidence') && (
                          <div style={S.flag}>low confidence</div>
                        )}
                        {(r.flags || []).includes('missing_time') && (
                          <div style={S.flag}>missing time</div>
                        )}
                      </td>
                      <td style={S.td}>
                        <input
                          value={r.duration}
                          onChange={(e) => updateRow(r.key, { duration: e.target.value })}
                          style={{ ...S.inputSm, width: 52 }}
                        />
                      </td>
                      <td style={S.td}>
                        <input
                          value={r.song}
                          onChange={(e) => updateRow(r.key, { song: e.target.value })}
                          style={S.inputSm}
                          placeholder="Song"
                        />
                        <input
                          value={r.note}
                          onChange={(e) => updateRow(r.key, { note: e.target.value })}
                          style={{ ...S.inputSm, marginTop: 4 }}
                          placeholder="Note"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {existingCount > 0 && (
              <div style={S.warn}>
                This event already has {existingCount} timeline moment{existingCount === 1 ? '' : 's'}.
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {['replace', 'merge'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWriteMode(m)}
                      style={{ ...S.chip, ...(writeMode === m ? S.chipOn : {}) }}
                    >
                      {m === 'replace' ? 'Replace' : 'Merge'}
                    </button>
                  ))}
                </div>
                {writeMode === 'replace' && (
                  <div style={{ color: C.orange, marginTop: 6, fontWeight: 600 }}>
                    Replace will overwrite the current timeline.
                  </div>
                )}
              </div>
            )}

            <div style={S.footer}>
              <button type="button" style={S.ghost} onClick={() => { setRows(null); setExtractError(''); }}>← Back</button>
              <button
                type="button"
                style={S.primary}
                disabled={!included.length}
                onClick={confirmApply}
              >
                Confirm Apply ({included.length})
              </button>
            </div>
          </>
        )}

        {applied && (
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Timeline updated</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Imported moments are on this event’s Run Sheet. You can edit them anytime.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={S.primary} onClick={onClose}>View timeline</button>
              {onRequestMcScripts && (
                <button type="button" style={S.secondary} onClick={() => { onClose(); onRequestMcScripts(); }}>
                  Generate MC scripts
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(22,22,26,0.35)', zIndex: 12000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    width: '100%', maxWidth: 820, maxHeight: '92vh', overflow: 'auto',
    background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
    padding: 20, fontFamily: BRAND_FONT, color: C.text,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  title: { fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.45 },
  x: { background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1 },
  tabs: { display: 'flex', gap: 8, marginBottom: 12 },
  tab: {
    border: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: 10,
    padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT, color: C.muted,
  },
  tabOn: { borderColor: C.accent, color: C.accent, background: C.accent + '14' },
  drop: {
    border: `2px dashed ${C.border}`, borderRadius: 14, padding: '36px 20px', textAlign: 'center',
    cursor: 'pointer', background: C.surfaceAlt, marginBottom: 12,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${C.border}`,
    padding: 12, fontSize: 13, fontFamily: BRAND_FONT, color: C.text, background: C.surfaceAlt,
    resize: 'vertical', marginBottom: 12, outline: 'none',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  primary: {
    background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  secondary: {
    background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  ghost: {
    background: 'transparent', border: 'none', color: C.muted, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: BRAND_FONT,
  },
  err: { color: C.red || '#DC2626', fontSize: 12, marginTop: 10 },
  errBox: {
    background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C',
    borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 8,
  },
  loading: { textAlign: 'center', padding: 24, color: C.muted, fontSize: 14 },
  reply: { fontSize: 14, fontWeight: 600, marginBottom: 10 },
  warn: {
    background: C.orange + '12', border: `1px solid ${C.orange}40`, borderRadius: 10,
    padding: 12, fontSize: 12, marginBottom: 12, lineHeight: 1.45,
  },
  tableWrap: { overflowX: 'auto', marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    textAlign: 'left', padding: '8px 10px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.muted,
  },
  td: { padding: '8px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' },
  inputSm: {
    width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '6px 8px', fontSize: 12, fontFamily: BRAND_FONT, color: C.text, background: C.bg, outline: 'none',
  },
  flag: { fontSize: 10, color: C.orange, fontWeight: 700, marginTop: 2 },
  chip: {
    border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '6px 10px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: BRAND_FONT, color: C.muted,
  },
  chipOn: { borderColor: C.accent, color: C.accent, background: C.accent + '15' },
};

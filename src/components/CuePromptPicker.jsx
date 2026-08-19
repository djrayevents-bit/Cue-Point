import { useMemo, useState } from 'react';
import { BRAND_FONT, BRAND_RADIUS, LIGHT_THEME } from '../brand';
import {
  CUE_PROMPT_CATEGORIES,
  QUICK_PROMPTS,
  sortCuePrompts,
} from '../cuePrompts';

const C = LIGHT_THEME;

/**
 * Prompt library dropdown — sits below the event picker in CUE surfaces.
 */
export default function CuePromptPicker({ onSelect, disabled = false }) {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState('');

  const filteredPrompts = useMemo(
    () => sortCuePrompts(QUICK_PROMPTS, 'label', category),
    [category],
  );

  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: BRAND_RADIUS.field,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: 12,
    fontFamily: BRAND_FONT,
    outline: 'none',
  };

  const handlePromptPick = (e) => {
    const label = e.target.value;
    setSelected('');
    if (!label) return;
    const prompt = QUICK_PROMPTS.find((p) => p.label === label);
    if (prompt) onSelect?.(prompt);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={labelStyle}>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={selectStyle}
          disabled={disabled}
        >
          {CUE_PROMPT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Prompt library</label>
        <select
          value={selected}
          onChange={handlePromptPick}
          style={selectStyle}
          disabled={disabled}
        >
          <option value="">Choose a prompt…</option>
          {filteredPrompts.map((p) => (
            <option key={p.label} value={p.label}>
              {category === 'All' ? `${p.label} · ${p.category}` : p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
};

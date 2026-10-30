import { DEFAULT_HIGHLIGHT, HIGHLIGHT_PRESETS, highlightInk, normalizeHex } from '../lib/highlightColors';

export function HighlightColorPicker({ value, onChange, labels = {} }: { value: string; onChange: (value: string) => void; labels?: Record<string, string> }) {
  const normalized = normalizeHex(value);
  const color = normalized ?? DEFAULT_HIGHLIGHT;
  const options = [...HIGHLIGHT_PRESETS, ...Object.keys(labels).filter(hex => !HIGHLIGHT_PRESETS.some(p => p.hex === hex))
    .map(hex => ({ name: hex, hex }))];
  return <fieldset className="highlight-colors">
    <legend>Highlight color</legend>
    <div className="highlight-swatches">
      {options.map(p => <button key={p.name} type="button" aria-label={`${p.name} highlight${labels[p.hex] ? ': ' + labels[p.hex] : ''}`}
        title={labels[p.hex] ? `${p.name}: ${labels[p.hex]}` : p.name} aria-pressed={normalized === p.hex}
        style={{ backgroundColor: p.hex, color: highlightInk(p.hex) }} onClick={() => onChange(p.hex)}>
        {normalized === p.hex ? '✓' : ''}<span className="swatch-name">{p.name}</span>
      </button>)}
    </div>
    <label>Hex color<input type="text" value={value} maxLength={7} spellCheck={false}
      placeholder="#AABBCC" aria-invalid={!normalized} onChange={e => onChange(e.target.value)} /></label>
    {!normalized && <p role="status">Enter a 3- or 6-digit hex color, such as #ABC or #AABBCC.</p>}
    <span className="highlight-color-preview" style={{ backgroundColor: color, color: highlightInk(color) }}>Highlight preview</span>
    {normalized && labels[normalized] && <span className="highlight-label">{labels[normalized]}</span>}
  </fieldset>;
}

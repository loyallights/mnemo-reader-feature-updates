import { useState } from 'react';
import { HIGHLIGHT_PRESETS, highlightColor, normalizeHex } from '../lib/highlightColors';

export function BookColorKey({ labels, usedColors, hiddenColors, onRemove, onAdd, onChange, onRetry, unsaved, disabled }: {
  labels: Record<string, string>;
  usedColors: (string | undefined)[];
  hiddenColors: string[];
  onRemove: (hex: string) => void;
  onAdd: (hex: string) => void;
  onChange: (labels: Record<string, string>) => void;
  onRetry: () => void;
  unsaved: boolean;
  disabled: boolean;
}) {
  const [restore, setRestore] = useState('');
  const [custom, setCustom] = useState('');
  const allColors = [...new Set([...HIGHLIGHT_PRESETS.map(p => p.hex), ...usedColors.map(highlightColor), ...Object.keys(labels), ...hiddenColors])];
  const colors = allColors.filter(hex => !hiddenColors.includes(hex));
  const customHex = normalizeHex(custom);
  return <details className="book-note-entry color-key-toggle" aria-label="Color key">
    <summary>Color key{unsaved && <span> — unsaved changes</span>}</summary>
    <p>Give each color your own meaning for this book. Labels start blank.</p>
    <div className="book-color-key">
      {colors.map(hex => {
        const name = HIGHLIGHT_PRESETS.find(p => p.hex === hex)?.name ?? hex;
        return <div key={hex} className="color-key-row">
          <span className="color-key-swatch" style={{ backgroundColor: hex }} aria-hidden="true" />
          <span className="color-key-name">{name}</span>
          <input type="text" aria-label={`${name} color label`} value={labels[hex] ?? ''}
            placeholder="Your label" disabled={disabled}
            onChange={e => onChange({ ...labels, [hex]: e.target.value })} />
          <button className="chip" aria-label={`Remove ${name} from color key`} title="Remove from color key" disabled={disabled} onClick={() => onRemove(hex)}>×</button>
        </div>;
      })}
    </div>
    {!colors.length && <p>Your color key is empty. Add a color below when you need one.</p>}
    <p>Removing a color keeps existing highlights and its saved label.</p>
    {hiddenColors.length > 0 && <div className="color-key-add">
      <label>Add a removed color<select value={restore} disabled={disabled} onChange={e => setRestore(e.target.value)}>
        <option value="">Choose a color</option>
        {hiddenColors.map(hex => <option key={hex} value={hex}>{HIGHLIGHT_PRESETS.find(p => p.hex === hex)?.name ?? hex}{labels[hex] ? ` — ${labels[hex]}` : ''}</option>)}
      </select></label>
      <button className="chip" disabled={disabled || !hiddenColors.includes(restore)} onClick={() => { onAdd(restore); setRestore(''); }}>Add color</button>
    </div>}
    <div className="color-key-add">
      <label>Custom color hex<input type="text" placeholder="#AABBCC" value={custom} maxLength={7} disabled={disabled}
        aria-invalid={custom.length > 0 && !customHex} onChange={e => setCustom(e.target.value)} /></label>
      <button className="chip" disabled={disabled || !customHex || colors.includes(customHex)} onClick={() => { if (customHex) { onAdd(customHex); setCustom(''); } }}>Add custom color</button>
    </div>
    {custom && !customHex && <p role="status">Enter a 3- or 6-digit hex color.</p>}
    <p role="status">{unsaved ? 'Color labels have unsaved changes.' : 'Color labels saved on this device.'}</p>
    {unsaved && <button className="chip" disabled={disabled} onClick={onRetry}>Save color key</button>}
  </details>;
}

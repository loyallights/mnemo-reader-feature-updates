export const HIGHLIGHT_PRESETS = [
  { name: 'Red', hex: '#f28b82' },
  { name: 'Orange', hex: '#fbbc75' },
  { name: 'Yellow', hex: '#eed16a' },
  { name: 'Green', hex: '#a8dab5' },
  { name: 'Blue', hex: '#8ab4f8' },
  { name: 'Indigo', hex: '#a8a0ed' },
  { name: 'Violet', hex: '#d7aefb' },
] as const;
export const DEFAULT_HIGHLIGHT = '#eed16a';

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
  return '#' + (hex.length === 3 ? [...hex].map(c => c + c).join('') : hex).toLowerCase();
}

export function highlightColor(value?: string): string {
  return normalizeHex(value ?? '') ?? DEFAULT_HIGHLIGHT;
}

/** Choose the higher-contrast text color, including for very dark custom colors. */
export function highlightInk(background: string): string {
  const hex = highlightColor(background).slice(1);
  const rgb = [0, 2, 4].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}

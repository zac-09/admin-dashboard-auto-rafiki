/**
 * AutoRafiki design tokens (same identity as the app; the ops tool is dark throughout).
 * Tailwind reads the same values from `src/index.css` (@theme); a unit test keeps the two
 * in sync. App code uses Tailwind classes (bg-surface, text-muted, …), never these hexes.
 */
export const colors = {
  background: '#101215',
  surface: '#17191C',
  hairline: '#333C47',
  textPrimary: '#F4F6F8',
  textMuted: '#B7C0C9',
  accent: '#19C2D8',
  onAccent: '#101215',
  accentText: '#0B6875', // the only accent allowed as text on light surfaces
  success: '#34C08B',
  danger: '#FF7B72',
  warning: '#DFAD4C',
} as const;

export type ColorToken = keyof typeof colors;

/** Tailwind colour name for each token (`bg-<name>`, `text-<name>`, `border-<name>`). */
export const tailwindColorNames: Record<ColorToken, string> = {
  background: 'background',
  surface: 'surface',
  hairline: 'hairline',
  textPrimary: 'primary',
  textMuted: 'muted',
  accent: 'accent',
  onAccent: 'on-accent',
  accentText: 'accent-text',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
};

/** Sharp corners by design: 3 for controls, 6 for panels. No pills. */
export const radii = { control: 3, panel: 6 } as const;

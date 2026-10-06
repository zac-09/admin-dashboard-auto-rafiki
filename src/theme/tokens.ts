/**
 * AutoRafiki palettes, exactly as in the app repo (src/theme/palettes/autorafiki.ts) plus
 * `warning`, which the dashboard adds. Light is the default; dark is a per-browser setting.
 * `src/index.css` carries the same values as CSS variables on :root and [data-theme="dark"]
 * (a unit test keeps them in sync). App code uses Tailwind classes, never these hexes.
 */
export const lightColors = {
  background: '#FFFFFF',
  surface: '#F3F5F7',
  hairline: '#D9DEE3',
  textPrimary: '#101215',
  textMuted: '#5B6570',
  accent: '#0E8FA3', // darker cyan: works as both fill and text on white (4.6:1)
  onAccent: '#FFFFFF',
  accentText: '#0B6875',
  success: '#1E8E63',
  danger: '#C62828',
  warning: '#9A6200',
} as const;

export const darkColors = {
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

export type ColorToken = keyof typeof lightColors;
export type Palette = Record<ColorToken, string>;
export type ThemeMode = 'light' | 'dark';

export const palettes: Record<ThemeMode, Palette> = { light: lightColors, dark: darkColors };

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

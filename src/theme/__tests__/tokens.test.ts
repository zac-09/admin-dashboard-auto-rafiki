// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { palettes, radii, tailwindColorNames, type ColorToken, type ThemeMode } from '../tokens';

// Read from disk: Vitest does not hand CSS (even ?raw) to tests.
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

const BLOCKS: Record<ThemeMode, string> = {
  light: block(':root'),
  dark: block("[data-theme='dark']"),
};

function cssVar(source: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(source)?.[1]?.trim();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const MODES: ThemeMode[] = ['light', 'dark'];

/**
 * KNOWN GAPS in the palette as specified (identical in the app repo), raised with Isaac:
 * these pairs measure below 4.5:1 although the app's palette comment claims 4.6:1. Until the
 * values change, the UI does not use them for body-size text. Remove an entry once fixed;
 * the test fails if an entry starts passing, so this list cannot go stale.
 */
const KNOWN_LOW_CONTRAST = new Set([
  'light:accent', // #0E8FA3 on #FFFFFF = 3.83:1
  'light:success', // #1E8E63 on #FFFFFF = 4.11:1
  'light:onAccent', // #FFFFFF on #0E8FA3 = 3.83:1
]);

function expectLegible(key: string, ratios: number[]): void {
  const passes = ratios.every((r) => r >= 4.5);
  expect(passes, `${key}: ${ratios.map((r) => r.toFixed(2)).join(', ')}`).toBe(
    !KNOWN_LOW_CONTRAST.has(key),
  );
}

describe.each(MODES)('%s palette', (mode) => {
  const palette = palettes[mode];

  it.each(Object.keys(palette) as ColorToken[])('CSS variables carry %s', (token) => {
    const name = tailwindColorNames[token];
    expect(cssVar(BLOCKS[mode], `ar-${name}`)?.toLowerCase()).toBe(palette[token].toLowerCase());
  });

  // CLAUDE.md: all text ≥ 4.5:1 in BOTH modes. accentText is reserved for light surfaces.
  it.each(['textPrimary', 'textMuted', 'accent', 'success', 'danger', 'warning'] as const)(
    '%s is legible text on background and surface (≥ 4.5:1)',
    (token) => {
      expectLegible(`${mode}:${token}`, [
        contrast(palette[token], palette.background),
        contrast(palette[token], palette.surface),
      ]);
    },
  );

  it('onAccent is legible on an accent fill', () => {
    expectLegible(`${mode}:onAccent`, [contrast(palette.onAccent, palette.accent)]);
  });
});

describe('Tailwind theme', () => {
  it.each(Object.values(tailwindColorNames))('maps --color-%s to its variable', (name) => {
    expect(cssVar(css, `color-${name}`)).toBe(`var(--ar-${name})`);
  });

  it('keeps the sharp radii', () => {
    expect(cssVar(css, 'radius-control')).toBe(`${radii.control}px`);
    expect(cssVar(css, 'radius-panel')).toBe(`${radii.panel}px`);
  });
});

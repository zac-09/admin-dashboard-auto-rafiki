// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { colors, radii, tailwindColorNames } from '../tokens';

// Read from disk: Vitest does not hand CSS (even ?raw) to tests.
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function cssVar(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

describe('design tokens', () => {
  it.each(Object.entries(colors))('Tailwind theme carries %s', (token, hex) => {
    const name = tailwindColorNames[token as keyof typeof colors];
    expect(cssVar(`color-${name}`)?.toLowerCase()).toBe(hex.toLowerCase());
  });

  it('keeps the sharp radii', () => {
    expect(cssVar('radius-control')).toBe(`${radii.control}px`);
    expect(cssVar('radius-panel')).toBe(`${radii.panel}px`);
  });
});

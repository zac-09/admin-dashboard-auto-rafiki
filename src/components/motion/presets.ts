import type { Transition } from 'motion/react';

/**
 * One motion language, ported from the app (src/components/motion/presets.ts there): springs
 * for things that move, eased timing for fades. Same names and numbers, so a panel settles
 * on the dashboard exactly as it does on the phone.
 */
export const springs = {
  /** Panels and sheets: fast out, soft landing, no bounce. */
  settle: { type: 'spring', damping: 18, stiffness: 160, mass: 0.9 },
  /** Taps and selections: quick, a hint of overshoot. */
  snappy: { type: 'spring', damping: 14, stiffness: 260, mass: 0.6 },
  /** Attention (seal, tick, count change): visible bounce. */
  pop: { type: 'spring', damping: 10, stiffness: 320, mass: 0.5 },
} as const satisfies Record<string, Transition>;

const easeOutQuad = [0.5, 1, 0.89, 1] as const;
const easeInQuad = [0.11, 0, 0.5, 0] as const;

export const timings = {
  fade: { duration: 0.26, ease: easeOutQuad },
  /** Exits sit just under the fade so nothing snaps out faster than it came in. */
  exit: { duration: 0.22, ease: easeInQuad },
} as const satisfies Record<string, Transition>;

/** Stagger step for list rows (ms). */
export const STAGGER_MS = 55;
/** Longest a list should take to finish arriving, however many rows it has (ms). */
export const STAGGER_TOTAL_MS = 300;

/**
 * Entrance delay (ms) for row `index` of `count`: a 55 ms step for short lists, compressed so
 * the whole list lands within 300 ms. Ported verbatim from the app.
 */
export function staggerDelay(index: number, count: number): number {
  if (index <= 0 || count <= 1) return 0;
  const step = Math.min(STAGGER_MS, STAGGER_TOTAL_MS / (count - 1));
  return Math.round(Math.min(index * step, STAGGER_TOTAL_MS));
}

let scale = 1;

/**
 * Wall-clock waits that sequence a moment (hold before continuing, tick drawn). Tests set the
 * scale to 0 so flows never wait on choreography; animations themselves are skipped there too.
 */
export function ms(duration: number): number {
  return duration * scale;
}

export function setMotionScaleForTesting(value: number): void {
  scale = value;
}

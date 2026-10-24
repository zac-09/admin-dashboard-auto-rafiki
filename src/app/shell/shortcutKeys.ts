import { can } from '@/lib/permissions';
import type { AdminRole } from '@/types';

import { NAV_ITEMS } from '../navigation';

/** How long after "g" the second key still counts (ms). */
export const SEQUENCE_MS = 1500;

export type ShortcutAction =
  { kind: 'go'; to: string } | { kind: 'search' } | { kind: 'help' } | { kind: 'pending' } | null;

/** True while the person is typing somewhere: shortcuts must never steal those keys. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type))
  );
}

/**
 * What a key press means, given whether "g" was just pressed. Only modules the role can open
 * are reachable; anything else does nothing.
 */
export function shortcutFor(key: string, afterG: boolean, role: AdminRole | null): ShortcutAction {
  if (afterG) {
    const item = NAV_ITEMS.find((i) => i.key === key.toLowerCase() && can(role, i.permission));
    return item ? { kind: 'go', to: item.to } : null;
  }
  if (key === 'g') return { kind: 'pending' };
  if (key === '/') return can(role, 'support.view') ? { kind: 'search' } : null;
  if (key === '?') return { kind: 'help' };
  return null;
}

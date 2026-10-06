import { create } from 'zustand';

import type { ThemeMode } from './tokens';

/** Must match the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'autorafiki.theme';

function readStored(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(mode: ThemeMode): void {
  if (mode === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
}

/** Crossfade light ↔ dark with a View Transition where supported (instant otherwise). */
function applyWithCrossfade(mode: ThemeMode): void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduced) doc.startViewTransition(() => apply(mode));
  else apply(mode);
}

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  toggle(): void;
}

/** Light by default; dark is remembered per browser. The map style follows `mode`. */
export const useThemeMode = create<ThemeState>((set, get) => ({
  mode: readStored(),
  setMode(mode) {
    applyWithCrossfade(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    set({ mode });
  },
  toggle() {
    get().setMode(get().mode === 'dark' ? 'light' : 'dark');
  },
}));

import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

import { setMotionScaleForTesting } from '@/components/motion';

// Pages load on demand (lazy chunks), and Vitest compiles a page the first time a test opens
// it. Under a full parallel run on a busy laptop that first load has taken over 3 s, so
// findBy* waits up to 10 s. It only slows a test that is failing anyway.
configure({ asyncUtilTimeout: 10_000 });

// Animations complete instantly and moments never hold, so tests assert outcomes, not timing.
MotionGlobalConfig.skipAnimations = true;
setMotionScaleForTesting(0);

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      // Tests render the desktop layout; reduced motion is off.
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  globalThis.sessionStorage?.clear();
  // Remembered tabs, periods and sorts must not carry from one test into the next.
  for (const key of Object.keys(globalThis.localStorage ?? {})) {
    if (key.startsWith('autorafiki.pref.')) globalThis.localStorage.removeItem(key);
  }
});

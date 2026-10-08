import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

import { setMotionScaleForTesting } from '@/components/motion';

// Pages load on demand (lazy chunks); under a full parallel run the first load of a page can
// take over a second, so findBy* waits up to 3 s instead of 1 s.
configure({ asyncUtilTimeout: 3000 });

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
});

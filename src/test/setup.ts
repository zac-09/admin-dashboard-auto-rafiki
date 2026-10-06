import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

import { setMotionScaleForTesting } from '@/components/motion';

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

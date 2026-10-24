import type { ReactNode } from 'react';

import { Reveal } from '../motion/Reveal';

/** Inline message. The tone is spelled out in text and shape, never by colour alone. */
export function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  const isError = tone === 'error';
  return (
    // Settles in from above, so a new error or confirmation is noticed without a jolt.
    <Reveal
      from="down"
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
        isError ? 'border-danger text-danger' : 'border-hairline text-primary'
      }`}
    >
      <span aria-hidden className="mt-1.5 diamond" />
      <span>
        <span className="font-semibold">{isError ? 'Error: ' : 'Note: '}</span>
        {children}
      </span>
    </Reveal>
  );
}

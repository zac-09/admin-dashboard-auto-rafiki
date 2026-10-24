import type { ReactNode } from 'react';

import { formatExact } from '@/lib/format';

/**
 * A relative time ("12 min ago", "for 4 min") that shows the exact Kampala time on hover,
 * and carries it as a machine-readable <time>. The dotted underline says there is more.
 */
export function Since({ at, children }: { at: string; children: ReactNode }) {
  return (
    <time
      dateTime={at}
      title={formatExact(at)}
      className="cursor-help underline decoration-dotted underline-offset-2"
    >
      {children}
    </time>
  );
}

import { lazy, Suspense } from 'react';

import { Reveal, staggerDelay } from '@/components/motion';

import { coverage } from './coverage';
import type { InsightsData } from './InsightsPage';

const CoverageMap = lazy(() => import('./CoverageMap'));

const TOP = 10;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function CoverageTab({ data }: { data: InsightsData }) {
  const result = coverage(data.jobs, data.mechanics);
  const gaps = result.areas.filter((a) => a.unserved > 0).slice(0, TOP);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Requests that ended with no mechanic (the broadcast ran out or the customer gave up
        waiting), grouped into areas of about 2 km, against where verified mechanics were last seen.
        The app keeps only each mechanic's latest location, not a history, so this shows where they
        are now. {result.unserved} of {result.requests} finished requests went unanswered
        {result.requests ? ` (${pct(result.unserved / result.requests)})` : ''}.
      </p>
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Loading map"
            className="panel skeleton h-[55vh] min-h-80"
          />
        }
      >
        <CoverageMap areas={result.areas} mechanics={data.mechanics} />
      </Suspense>
      <section aria-label="Top unserved areas" className="panel">
        <h3 className="micro-label px-4 pt-4 pb-2">Where to recruit next</h3>
        {gaps.length === 0 ? (
          <p className="flex items-center gap-3 px-4 pb-4 text-sm text-muted">
            <span aria-hidden className="diamond text-success" />
            Every finished request in this period found a mechanic.
          </p>
        ) : (
          <ol aria-label="Unserved areas, worst first">
            {gaps.map((a, i) => (
              <Reveal
                as="li"
                key={a.key}
                delay={staggerDelay(i, gaps.length)}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-hairline px-4 py-3 text-sm last:border-0"
              >
                <span className="flex min-w-56 flex-1 items-baseline gap-3">
                  <span className="w-5 text-muted">{i + 1}.</span>
                  <span className="font-semibold">{a.label}</span>
                </span>
                <span>
                  {a.unserved} of {a.requests} unanswered ({pct(a.unservedShare)})
                </span>
                <span className="text-xs text-muted">
                  {a.nearestMechanicKm === null
                    ? 'No verified mechanic location known'
                    : `Nearest verified mechanic ${a.nearestMechanicKm.toFixed(1)} km away`}
                </span>
              </Reveal>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

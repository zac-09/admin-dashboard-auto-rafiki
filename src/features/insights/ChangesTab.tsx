import { useQuery } from '@tanstack/react-query';

import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonPanel } from '@/components/ui';
import { formatDateTime, formatUgx } from '@/lib/format';
import { useRepositories } from '@/lib/repositories';

import { change } from './report';
import type { InsightsData } from './InsightsPage';
import { COMPARE_DAYS, settingsChanges, type PeriodMetrics } from './priceChanges';

const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const minutes = (v: number) => `${Math.round(v)} min`;

const ROWS: {
  label: string;
  pick: (m: PeriodMetrics) => number | null;
  format: (v: number) => string;
}[] = [
  { label: 'Requests a day', pick: (m) => (m.days ? m.requestsPerDay : null), format: oneDp },
  { label: 'Unanswered', pick: (m) => m.unansweredShare, format: pct },
  { label: 'Completed (of accepted)', pick: (m) => m.completionShare, format: pct },
  { label: 'Request to arrival (median)', pick: (m) => m.medianArrivalMin, format: minutes },
  { label: 'Average fee', pick: (m) => m.averageFee, format: formatUgx },
];

/** What moved after each published settings change. */
export function ChangesTab({ data }: { data: InsightsData }) {
  const { audit } = useRepositories();
  const entries = useQuery({
    queryKey: ['audit', 'all', 'insights', data.since],
    queryFn: () => audit.listEntries(data.since),
  });
  if (entries.error) {
    return <Notice tone="error">Could not load settings changes: {entries.error.message}</Notice>;
  }
  if (entries.isPending) return <SkeletonPanel lines={4} />;
  const changes = settingsChanges(entries.data, data.jobs, data.now);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Each time prices or broadcast values were published, the {COMPARE_DAYS} days before against
        the {COMPARE_DAYS} days after (shorter when another change came sooner, or the change is
        recent). A comparison, not proof: growth, weather and holidays move these numbers too.
      </p>
      {changes.length === 0 ? (
        <Reveal className="panel p-6 text-sm text-muted">
          No settings published in the last ten weeks.
        </Reveal>
      ) : (
        changes.map((c, i) => (
          <Reveal
            key={c.entry.id}
            as="section"
            aria-label={`Change of ${formatDateTime(c.entry.at)}`}
            delay={staggerDelay(i, changes.length)}
            className="panel flex flex-col gap-3 p-5"
          >
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{c.entry.targetLabel}</h3>
              <span className="text-xs text-muted">
                {formatDateTime(c.entry.at)} · {c.entry.actorEmail ?? c.entry.actorUid} ·{' '}
                {c.entry.reason}
              </span>
              {c.broadcastNotes.length ? (
                <span className="text-sm">{c.broadcastNotes.join(' · ')}</span>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs text-muted">
                    <th scope="col" className="py-1.5 font-normal">
                      Measure
                    </th>
                    <th scope="col" className="py-1.5 font-normal">
                      Before ({Math.round(c.before.days)} days)
                    </th>
                    <th scope="col" className="py-1.5 font-normal">
                      After ({Math.round(c.after.days)} days)
                    </th>
                    <th scope="col" className="py-1.5 font-normal">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const b = row.pick(c.before);
                    const a = row.pick(c.after);
                    return (
                      <tr key={row.label} className="border-b border-hairline last:border-0">
                        <th scope="row" className="py-1.5 text-left font-normal">
                          {row.label}
                        </th>
                        <td className="py-1.5">{b === null ? '–' : row.format(b)}</td>
                        <td className="py-1.5">{a === null ? '–' : row.format(a)}</td>
                        <td className="py-1.5 text-muted">
                          {change(a, b, row.format).replace(' from ', ', was ')}
                        </td>
                      </tr>
                    );
                  })}
                  {c.services.map((s) => (
                    <tr key={s.service} className="border-b border-hairline last:border-0">
                      <th scope="row" className="py-1.5 text-left font-normal">
                        {s.label} requests a day (
                        {s.priceBefore === null ? 'new' : formatUgx(s.priceBefore)} →{' '}
                        {formatUgx(s.priceAfter)})
                      </th>
                      <td className="py-1.5">{oneDp(s.perDayBefore)}</td>
                      <td className="py-1.5">{oneDp(s.perDayAfter)}</td>
                      <td className="py-1.5 text-muted">
                        {change(s.perDayAfter, s.perDayBefore, oneDp).replace(' from ', ', was ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        ))
      )}
    </div>
  );
}

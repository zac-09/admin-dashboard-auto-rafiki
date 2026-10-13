import type { ReactNode } from 'react';

import { Reveal, staggerDelay } from '@/components/motion';
import { ARRIVAL_TARGET_MIN } from '@/features/revenue/kpis';
import { formatUgx } from '@/lib/format';

import type { InsightsData } from './InsightsPage';
import { INSIGHT_WEEKS } from './hooks';
import { LineChart, type ChartPoint } from './LineChart';
import { shortWeek } from './weekLabels';
import { lastWeeks, weeklyTrends, type WeekPoint } from './trends';

const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const minutes = (v: number) => `${Math.round(v)} min`;
const ugxShort = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);

/** Last full week against four weeks before it, in words. */
function compare(
  trend: readonly WeekPoint[],
  pick: (w: WeekPoint) => number | null,
  format: (v: number) => string,
): string {
  const full = trend.filter((w) => !w.partial);
  const last = full[full.length - 1];
  const before = full[full.length - 5];
  const now = last ? pick(last) : null;
  if (!last || now === null) return 'No full week of data yet.';
  const then = before ? pick(before) : null;
  return then === null
    ? `Last full week: ${format(now)}.`
    : `Last full week: ${format(now)}, against ${format(then)} four weeks earlier.`;
}

function ChartCard({
  index,
  label,
  context,
  highlight = false,
  children,
}: {
  index: number;
  label: string;
  context: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 4)}
      className={`panel flex min-w-0 flex-col gap-2 p-5 ${highlight ? 'border-primary' : ''}`}
    >
      <h3 className="micro-label">{label}</h3>
      <p className="text-sm">{context}</p>
      {children}
    </Reveal>
  );
}

export function TrendsTab({ data }: { data: InsightsData }) {
  const { jobs, mechanics, entries, payments, now } = data;
  const trend = weeklyTrends(
    lastWeeks(INSIGHT_WEEKS, now),
    jobs,
    mechanics,
    entries,
    payments,
    now,
  );
  const series = (pick: (w: WeekPoint) => number | null): ChartPoint[] =>
    trend.map((w) => ({ label: shortWeek(w.weekStart), value: pick(w), partial: w.partial }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Week by week (Monday to Sunday, Kampala time) for the last {INSIGHT_WEEKS} weeks. This week
        is drawn hollow: its numbers are so far, not final.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          index={0}
          highlight
          label="Jobs per mechanic per week"
          context={compare(trend, (w) => w.jobsPerMechanic, oneDp)}
        >
          <LineChart
            title="Jobs per mechanic"
            points={series((w) => w.jobsPerMechanic)}
            format={oneDp}
            target={{ value: 3, label: 'Active: 3 a week' }}
          />
        </ChartCard>
        <ChartCard
          index={1}
          label="Request to arrival (median)"
          context={compare(trend, (w) => w.medianArrivalMin, minutes)}
        >
          <LineChart
            title="Median minutes to arrival"
            points={series((w) => w.medianArrivalMin)}
            format={minutes}
            target={{ value: ARRIVAL_TARGET_MIN, label: `Target ${ARRIVAL_TARGET_MIN} min` }}
          />
        </ChartCard>
        <ChartCard
          index={2}
          label="Subscriptions collected"
          context={compare(trend, (w) => w.collected, formatUgx)}
        >
          <LineChart
            title="Collected (UGX)"
            points={series((w) => w.collected)}
            format={ugxShort}
          />
        </ChartCard>
        <ChartCard
          index={3}
          label="Requests nobody took"
          context={compare(trend, (w) => w.unservedShare, pct)}
        >
          <LineChart
            title="Share unanswered"
            points={series((w) => w.unservedShare)}
            format={pct}
            max={1}
          />
        </ChartCard>
      </div>
    </div>
  );
}

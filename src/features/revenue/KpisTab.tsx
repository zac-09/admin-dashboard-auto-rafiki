import { useState, type ReactNode } from 'react';

import { AnimatedNumber, Reveal, staggerDelay } from '@/components/motion';
import { Button, Notice, SkeletonPanel, Tabs } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';

import { jobsCsv } from './exports';
import { useKpiInputs } from './hooks';
import { ARRIVAL_TARGET_MIN, computeKpis } from './kpis';

const WINDOWS = [
  { id: '7' as const, label: 'Last 7 days' },
  { id: '30' as const, label: 'Last 30 days' },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

function Card({
  label,
  value,
  context,
  state,
  index,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  context: string;
  /** Spelled out, with a shape, never colour alone. */
  state?: { good: boolean; text: string };
  index: number;
  highlight?: boolean;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 7)}
      className={`panel flex flex-col gap-2 p-5 ${highlight ? 'border-primary' : ''}`}
    >
      <h3 className="micro-label">{label}</h3>
      <span className="text-3xl font-light">{value}</span>
      <span className="text-xs text-muted">{context}</span>
      {state ? (
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span
            aria-hidden
            className={`size-2 rotate-45 ${state.good ? 'bg-success' : 'sonar bg-warning text-warning'}`}
          />
          {state.text}
        </span>
      ) : null}
    </Reveal>
  );
}

const none = <span className="text-muted">–</span>;

export function KpisTab() {
  const [range, setRange] = useState<'7' | '30'>('7');
  const days = Number(range);
  const inputs = useKpiInputs(days);

  if (inputs.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading KPIs"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonPanel key={i} lines={2} />
        ))}
      </div>
    );
  }
  if (inputs.error)
    return <Notice tone="error">Could not load KPIs: {inputs.error.message}</Notice>;

  const { jobs, ratings, mechanics } = inputs.data;
  const now = new Date();
  const k = computeKpis(jobs, ratings, mechanics, days, now);
  const inWindow = jobs.filter(
    (j) => Date.parse(j.request.createdAt) >= now.getTime() - days * 86_400_000,
  );

  function exportJobs() {
    const names = new Map(mechanics.map((m) => [m.userId, m.businessName]));
    downloadCsv(`autorafiki-jobs-last-${days}-days.csv`, jobsCsv(inWindow, names));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs label="KPI window" value={range} onChange={setRange} items={WINDOWS} />
        <Button variant="secondary" onClick={exportJobs}>
          Export jobs CSV
        </Button>
      </div>
      <div key={range} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          index={0}
          highlight
          label="Jobs per mechanic per week"
          value={k.jobsPerMechanicPerWeek === null ? none : oneDp(k.jobsPerMechanicPerWeek)}
          context={`Completed jobs per week ÷ ${k.verifiedMechanics} verified mechanics. The pilot's make-or-break number.`}
        />
        <Card
          index={1}
          label="Request to arrival (median)"
          value={
            k.medianArrivalMin === null ? (
              none
            ) : (
              <>
                <AnimatedNumber value={Math.round(k.medianArrivalMin)} /> min
              </>
            )
          }
          context={`Over ${k.arrivalsMeasured} ${k.arrivalsMeasured === 1 ? 'arrival' : 'arrivals'}. Target under ${ARRIVAL_TARGET_MIN} min.`}
          state={
            k.medianArrivalMin === null
              ? undefined
              : k.medianArrivalMin < ARRIVAL_TARGET_MIN
                ? { good: true, text: 'On target' }
                : { good: false, text: 'Over target' }
          }
        />
        <Card
          index={2}
          label="Jobs per day"
          value={oneDp(k.jobsPerDay)}
          context={`${k.jobs} ${k.jobs === 1 ? 'request' : 'requests'} in ${days} days.`}
        />
        <Card
          index={3}
          label="Active mechanics"
          value={<AnimatedNumber value={k.activeMechanics} />}
          context={`Of ${k.verifiedMechanics} verified, at least 3 completed jobs in the last 7 days.`}
        />
        <Card
          index={4}
          label="Acceptance rate"
          value={k.acceptanceRate === null ? none : pct(k.acceptanceRate)}
          context="Requests a mechanic accepted, of those no longer waiting."
        />
        <Card
          index={5}
          label="Completion rate"
          value={k.completionRate === null ? none : pct(k.completionRate)}
          context="Accepted jobs completed rather than cancelled."
        />
        <Card
          index={6}
          label="Average rating"
          value={k.averageRating === null ? none : `★ ${oneDp(k.averageRating)}`}
          context={`Customers rating mechanics, ${k.ratings} ${k.ratings === 1 ? 'rating' : 'ratings'}.`}
        />
      </div>
    </div>
  );
}

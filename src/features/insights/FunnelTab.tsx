import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Reveal, springs, staggerDelay } from '@/components/motion';
import { Tabs } from '@/components/ui';
import { ARRIVAL_TARGET_MIN, median } from '@/features/revenue/kpis';
import { formatUgx } from '@/lib/format';
import { usePreference } from '@/lib/preferences';

import {
  CANCEL_STAGES,
  CANCELLER_LABELS,
  CANCELLERS,
  funnel,
  legs,
  requestedWithin,
  serviceMix,
  STAGE_LABELS,
  vehicleMix,
  type Canceller,
  type MixRow,
} from './funnel';
import type { InsightsData } from './InsightsPage';
import { arrivalMinutes } from './jobFacts';

const PERIODS = [
  { id: '7' as const, label: 'Last 7 days' },
  { id: '28' as const, label: 'Last 4 weeks' },
  { id: '70' as const, label: 'Last 10 weeks' },
];
type Period = (typeof PERIODS)[number]['id'];

const TH = 'px-3 py-2 text-left text-xs font-normal text-muted';
const TD = 'px-3 py-2 align-top';
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
const minutes = (v: number | null) => (v === null ? '–' : `${Math.round(v)} min`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Panel({
  index,
  label,
  context,
  wide = false,
  children,
}: {
  index: number;
  label: string;
  context: string;
  /** Both columns on wide screens (tables). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 5)}
      className={`panel flex min-w-0 flex-col gap-3 p-5 ${wide ? 'lg:col-span-2' : ''}`}
    >
      <h3 className="micro-label">{label}</h3>
      <p className="text-sm text-muted">{context}</p>
      {children}
    </Reveal>
  );
}

/** A magnitude bar; the number beside it carries the meaning. */
function Bar({ share, delay = 0 }: { share: number; delay?: number }) {
  return (
    <span aria-hidden className="block h-2 w-full overflow-hidden rounded-[2px] bg-surface">
      {/* Grows from the left (and glides when the period changes); a fade under reduced motion. */}
      <motion.span
        className="block h-full origin-left rounded-[2px] bg-accent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, share)) }}
        transition={{ ...springs.settle, delay: delay / 1000 }}
      />
    </span>
  );
}

function MixTable({ label, first, rows }: { label: string; first: string; rows: MixRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm" aria-label={label}>
        <thead>
          <tr className="border-b border-hairline">
            <th scope="col" className={TH}>
              {first}
            </th>
            <th scope="col" className={TH}>
              Requests
            </th>
            <th scope="col" className={TH}>
              Completed
            </th>
            <th scope="col" className={TH}>
              Nobody took
            </th>
            <th scope="col" className={TH}>
              Arrival (median)
            </th>
            <th scope="col" className={TH}>
              Average fee
            </th>
            <th scope="col" className={TH}>
              Fees on completed jobs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-hairline last:border-0">
              <th scope="row" className={`${TD} text-left font-semibold`}>
                {r.label}
              </th>
              <td className={TD}>{r.requests}</td>
              <td className={TD}>
                {pct(r.completionShare)}
                <span className="block text-xs text-muted">{r.completed} completed</span>
              </td>
              <td className={TD}>{pct(r.unservedShare)}</td>
              <td className={TD}>{minutes(r.medianArrivalMin)}</td>
              <td className={TD}>{r.averageFee === null ? '–' : formatUgx(r.averageFee)}</td>
              <td className={TD}>{formatUgx(r.completedFees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How far requests get, where the minutes go, and how each service and vehicle performs. */
export function FunnelTab({ data }: { data: InsightsData }) {
  const [period, setPeriod] = usePreference<Period>('funnel.period', '28', (v): v is Period =>
    PERIODS.some((p) => p.id === v),
  );
  const days = Number(period);
  const jobs = requestedWithin(data.jobs, days, data.now);
  const f = funnel(jobs);
  const legRows = legs(jobs);
  const legMax = Math.max(1, ...legRows.map((l) => l.medianMin ?? 0));
  const arrival = median(
    jobs.flatMap((j) => {
      const m = arrivalMinutes(j);
      return m === null ? [] : [m];
    }),
  );
  const services = serviceMix(jobs);
  const vehicles = vehicleMix(jobs);
  const fees = services.reduce((sum, r) => sum + r.completedFees, 0);
  const whoCancelled = [
    ...CANCELLERS,
    ...(CANCEL_STAGES.some((s) => f.cancellations[s].unknown) ? (['unknown'] as const) : []),
  ] satisfies Canceller[];

  return (
    <div className="flex flex-col gap-4">
      <Tabs label="Funnel period" value={period} onChange={setPeriod} items={PERIODS} />
      <p className="text-sm text-muted">
        {plural(f.requests, 'request')} in the{' '}
        {PERIODS.find((p) => p.id === period)!.label.toLowerCase()}
        {f.inProgress ? `, ${f.inProgress} still in progress` : ''}. Fees are the call-out fee fixed
        when the customer asked; on-site prices are not recorded, so money figures are a floor.{' '}
        {formatUgx(fees)} in call-out fees on completed jobs.
      </p>
      {f.requests === 0 ? (
        <p className="panel p-6 text-sm text-muted">No requests in this period.</p>
      ) : (
        <div key={period} className="grid gap-4 lg:grid-cols-2">
          <Panel
            index={0}
            label="Request funnel"
            context="How many requests reached each step. The drop between steps is where customers are lost."
          >
            <ol aria-label="Requests reaching each step" className="flex flex-col gap-3">
              {f.stages.map((s, i) => {
                const lost = i === 0 ? 0 : f.stages[i - 1]!.reached - s.reached;
                return (
                  <li key={s.stage} className="flex flex-col gap-1 text-sm">
                    <span className="flex items-baseline justify-between gap-3">
                      <span>{STAGE_LABELS[s.stage]}</span>
                      <span>
                        <span className="font-semibold">{s.reached}</span>{' '}
                        <span className="text-muted">({pct(s.reached / f.requests)})</span>
                        {lost > 0 ? (
                          <span className="ml-2 text-xs text-muted">{lost} fewer</span>
                        ) : null}
                      </span>
                    </span>
                    <Bar share={s.reached / f.requests} delay={staggerDelay(i, f.stages.length)} />
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel
            index={1}
            label="Where the minutes go"
            context={`Median minutes for each step of a breakdown (bookings left out). Request to arrival overall: ${minutes(arrival)} against a target under ${ARRIVAL_TARGET_MIN} min. Medians do not add up exactly.`}
          >
            <ol aria-label="Median minutes per step" className="flex flex-col gap-3">
              {legRows.map((l, i) => (
                <li key={l.id} className="flex flex-col gap-1 text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span>
                      {l.label}
                      {l.beforeArrival ? null : (
                        <span className="block text-xs text-muted">
                          After arrival, not in the target
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="font-semibold">{minutes(l.medianMin)}</span>
                      <span className="block text-xs text-muted">
                        over {plural(l.measured, 'job')}
                      </span>
                    </span>
                  </span>
                  <Bar
                    share={(l.medianMin ?? 0) / legMax}
                    delay={staggerDelay(i, legRows.length)}
                  />
                </li>
              ))}
            </ol>
          </Panel>

          <Panel
            index={2}
            label="Where requests are cancelled"
            context={`${plural(f.cancelled, 'cancellation')}, by the step the job had reached and who cancelled it.`}
          >
            {f.cancelled === 0 ? (
              <p className="flex items-center gap-3 text-sm text-muted">
                <span aria-hidden className="diamond text-success" />
                Nothing was cancelled in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[30rem] text-sm"
                  aria-label="Cancellations by step and who cancelled"
                >
                  <thead>
                    <tr className="border-b border-hairline">
                      <th scope="col" className={TH}>
                        Cancelled when
                      </th>
                      {whoCancelled.map((w) => (
                        <th key={w} scope="col" className={TH}>
                          {CANCELLER_LABELS[w]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CANCEL_STAGES.map((stage) => (
                      <tr key={stage} className="border-b border-hairline last:border-0">
                        <th scope="row" className={`${TD} text-left font-normal`}>
                          {stage === 'requested'
                            ? 'Waiting for a mechanic'
                            : stage === 'matched'
                              ? 'Accepted, not yet set off'
                              : 'Mechanic on the way'}
                        </th>
                        {whoCancelled.map((w) => (
                          <td key={w} className={TD}>
                            {f.cancellations[stage][w] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            index={3}
            label="Breakdowns and bookings"
            context="On-demand breakdowns against booked servicing."
          >
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {(() => {
                const booked = services.find((r) => r.key === 'booking');
                const bookedCount = booked?.requests ?? 0;
                return (
                  <>
                    <div className="flex flex-col gap-1">
                      <dt className="micro-label">Breakdowns</dt>
                      <dd className="text-2xl font-light">{f.requests - bookedCount}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="micro-label">Bookings</dt>
                      <dd className="text-2xl font-light">{bookedCount}</dd>
                      {booked ? (
                        <dd className="text-xs text-muted">
                          {pct(booked.completionShare)} completed, {formatUgx(booked.completedFees)}
                        </dd>
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </dl>
          </Panel>

          <Panel
            index={4}
            wide
            label="By service"
            context="Which problems customers bring, how often each is fixed, and what it earns mechanics. Completed and nobody-took are shares of finished requests."
          >
            <MixTable label="Requests by service" first="Service" rows={services} />
          </Panel>

          <Panel index={5} wide label="By vehicle" context="The same, by type of vehicle.">
            <MixTable label="Requests by vehicle" first="Vehicle" rows={vehicles} />
          </Panel>
        </div>
      )}
    </div>
  );
}

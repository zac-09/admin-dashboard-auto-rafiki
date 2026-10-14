import { useState, type ReactNode } from 'react';

import { AnimatedNumber, Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonPanel, Tabs } from '@/components/ui';
import { useInsightsInputs } from '@/features/insights/hooks';
import { shortWeek } from '@/features/insights/weekLabels';
import { formatUgx } from '@/lib/format';
import { WEEKLY_FEE } from '@/lib/subscriptions';

import {
  breakEvenJobsPerWeek,
  commissionModel,
  fullWeeks,
  MAX_RATE,
  MIN_RATE,
  PRESET_RATES,
} from './commission';

const WINDOWS = [
  { id: '4' as const, label: 'Last 4 weeks' },
  { id: '8' as const, label: 'Last 8 weeks' },
];
const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;
const TH = 'px-3 py-2 text-left text-xs font-normal text-muted';
const TD = 'px-3 py-2 align-top';

function Figure({
  label,
  index,
  children,
  context,
  highlight = false,
}: {
  label: string;
  index: number;
  children: ReactNode;
  context: string;
  highlight?: boolean;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 3)}
      className={`panel flex flex-col gap-2 p-5 ${highlight ? 'border-primary' : ''}`}
    >
      <h3 className="micro-label">{label}</h3>
      <span className="text-2xl font-light">{children}</span>
      <span className="text-xs text-muted">{context}</span>
    </Reveal>
  );
}

/** Phase 2 what-if: commission on completed jobs against the Phase 1 weekly subscription. */
export function Phase2Tab() {
  const inputs = useInsightsInputs();
  const [range, setRange] = useState<'4' | '8'>('4');
  const [percent, setPercent] = useState(10);

  if (inputs.isPending) {
    return (
      <div role="status" aria-label="Loading the model" className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonPanel key={i} lines={2} />
        ))}
      </div>
    );
  }
  if (inputs.error) {
    return <Notice tone="error">Could not load jobs: {inputs.error.message}</Notice>;
  }

  const { jobs, mechanics, entries, now } = inputs.data;
  const rate = percent / 100;
  const weeks = fullWeeks(Number(range), now);
  const model = commissionModel(weeks, jobs, mechanics, entries, rate);
  const perWeek = (v: number) => v / weeks.length;
  const averageFee = model.totals.completed ? model.totals.fees / model.totals.completed : 0;
  const jobsToMatch = breakEvenJobsPerWeek(averageFee, rate);
  const better = model.totals.commission >= model.totals.subscriptions;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        What the last {range} full weeks would have earned if AutoRafiki took a commission on each
        completed job instead of {formatUgx(WEEKLY_FEE)} a week per verified mechanic. Commission is
        on the call-out fee fixed when the customer requested; what is agreed on site for parts and
        labour is not recorded, so treat these figures as a floor. A model only: nothing here
        changes what mechanics are charged.
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs label="Model window" value={range} onChange={setRange} items={WINDOWS} />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Commission rate"
        >
          <span className="micro-label">Commission</span>
          {PRESET_RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={Math.round(r * 100) === percent}
              onClick={() => setPercent(Math.round(r * 100))}
              className="min-h-10 rounded-control border border-hairline px-3 text-sm aria-pressed:border-primary aria-pressed:font-semibold"
            >
              {pct(r)}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Commission percent</span>
            <input
              type="number"
              min={MIN_RATE * 100}
              max={MAX_RATE * 100}
              step={1}
              value={percent}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= MIN_RATE * 100 && v <= MAX_RATE * 100) setPercent(v);
              }}
              className="min-h-10 w-20 rounded-control border border-hairline bg-background px-3"
            />
            %
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Figure
          index={0}
          highlight
          label={`Commission at ${pct(rate)}`}
          context={`${formatUgx(perWeek(model.totals.commission))} a week on ${model.totals.completed} completed jobs (${formatUgx(model.totals.fees)} in fees).`}
        >
          <AnimatedNumber value={model.totals.commission} format={formatUgx} />
        </Figure>
        <Figure
          index={1}
          label="Weekly subscriptions"
          context={`${formatUgx(perWeek(model.totals.subscriptions))} a week asked of verified mechanics over the same weeks.`}
        >
          <AnimatedNumber value={model.totals.subscriptions} format={formatUgx} />
        </Figure>
        <Figure
          index={2}
          label="Break-even rate"
          context={
            jobsToMatch === null
              ? 'No completed jobs in the window.'
              : `At ${pct(rate)}, one mechanic needs ${Math.ceil(jobsToMatch)} jobs a week at the average fee (${formatUgx(averageFee)}) to match ${formatUgx(WEEKLY_FEE)}.`
          }
        >
          {model.breakEvenRate === null ? '–' : pct(model.breakEvenRate)}
        </Figure>
      </div>
      <p className="flex items-center gap-2 text-sm">
        <span aria-hidden className={`diamond ${better ? 'text-success' : 'text-warning'}`} />
        {model.totals.fees === 0
          ? 'No completed jobs in this window to model.'
          : better
            ? `At ${pct(rate)}, commission would have brought in ${formatUgx(model.totals.commission - model.totals.subscriptions)} more than subscriptions.`
            : `At ${pct(rate)}, commission would have brought in ${formatUgx(model.totals.subscriptions - model.totals.commission)} less than subscriptions.`}
      </p>

      <section aria-label="Week by week" className="panel overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={TH}>
                Week of
              </th>
              <th scope="col" className={TH}>
                Completed jobs
              </th>
              <th scope="col" className={TH}>
                Fees
              </th>
              <th scope="col" className={TH}>
                Commission at {pct(rate)}
              </th>
              <th scope="col" className={TH}>
                Subscriptions
              </th>
            </tr>
          </thead>
          <tbody>
            {model.weeks.map((w) => (
              <tr key={w.weekStart} className="border-b border-hairline last:border-0">
                <th scope="row" className={`${TD} text-left font-normal`}>
                  {shortWeek(w.weekStart)}
                </th>
                <td className={TD}>{w.completed}</td>
                <td className={TD}>{formatUgx(w.fees)}</td>
                <td className={TD}>{formatUgx(w.commission)}</td>
                <td className={TD}>{formatUgx(w.subscriptions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="By mechanic" className="panel overflow-x-auto">
        <h3 className="micro-label px-3 pt-4 pb-1">Who would pay more, who less</h3>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={TH}>
                Mechanic
              </th>
              <th scope="col" className={TH}>
                Completed
              </th>
              <th scope="col" className={TH}>
                Commission
              </th>
              <th scope="col" className={TH}>
                Subscription
              </th>
              <th scope="col" className={TH}>
                Under commission
              </th>
            </tr>
          </thead>
          <tbody>
            {model.mechanics.map((m) => (
              <tr key={m.mechanic.userId} className="border-b border-hairline last:border-0">
                <th scope="row" className={`${TD} text-left font-semibold`}>
                  {m.mechanic.businessName}
                </th>
                <td className={TD}>{m.completed}</td>
                <td className={TD}>{formatUgx(m.commission)}</td>
                <td className={TD}>{formatUgx(m.subscriptions)}</td>
                <td className={TD}>
                  {Math.round(m.difference) === 0
                    ? 'Pays the same'
                    : m.difference > 0
                      ? `Pays ${formatUgx(m.difference)} more`
                      : `Pays ${formatUgx(-m.difference)} less`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

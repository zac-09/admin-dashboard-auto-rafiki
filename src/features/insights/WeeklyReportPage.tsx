import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button, Notice, SkeletonDetail } from '@/components/ui';
import { ARRIVAL_TARGET_MIN } from '@/features/revenue/kpis';
import { formatDateTime, formatUgx } from '@/lib/format';
import { addWeeks, weekLabel, weekStartOf } from '@/lib/subscriptions';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { INSIGHT_WEEKS, useInsightsInputs } from './hooks';
import { change, weeklyReport, type ReportWeek } from './report';
import { SIGNAL_LABELS } from './scorecard';
import { lastWeeks } from './trends';
import { shortWeek } from './weekLabels';

const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const minutes = (v: number) => `${Math.round(v)} min`;
const count = (v: number) => String(Math.round(v));

function Number_({
  label,
  value,
  previous,
  format,
  note,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  format: (v: number) => string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-hairline pt-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-light">{value === null ? '–' : format(value)}</dd>
      <dd className="text-xs text-muted">
        {change(value, previous, format)}
        {note ? ` · ${note}` : ''}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="break-inside-avoid">
      <h2 className="micro-label mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Headline({ w, p }: { w: ReportWeek; p: ReportWeek }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 print:grid-cols-4">
      <Number_
        label="Jobs per mechanic"
        value={w.jobsPerMechanic}
        previous={p.jobsPerMechanic}
        format={oneDp}
        note={`${w.completed} completed ÷ ${w.verified} verified`}
      />
      <Number_
        label="Request to arrival (median)"
        value={w.medianArrivalMin}
        previous={p.medianArrivalMin}
        format={minutes}
        note={
          w.medianArrivalMin === null
            ? undefined
            : w.medianArrivalMin < ARRIVAL_TARGET_MIN
              ? `on target (< ${ARRIVAL_TARGET_MIN})`
              : `over the ${ARRIVAL_TARGET_MIN}-min target`
        }
      />
      <Number_ label="Requests" value={w.requests} previous={p.requests} format={count} />
      <Number_
        label="Requests nobody took"
        value={w.unservedShare}
        previous={p.unservedShare}
        format={pct}
      />
      <Number_
        label="Acceptance rate"
        value={w.acceptanceRate}
        previous={p.acceptanceRate}
        format={pct}
      />
      <Number_
        label="Completion rate"
        value={w.completionRate}
        previous={p.completionRate}
        format={pct}
      />
      <Number_
        label="Average rating"
        value={w.averageRating}
        previous={p.averageRating}
        format={(v) => `★ ${oneDp(v)}`}
        note={`${w.ratings} ratings`}
      />
      <Number_
        label="Subscriptions collected"
        value={w.collected}
        previous={p.collected}
        format={formatUgx}
        note={w.expected === null ? 'before tracking began' : `of ${formatUgx(w.expected)}`}
      />
    </dl>
  );
}

/** One printable page for the team, partners and investors: how the pilot did this week. */
export function WeeklyReportPage() {
  const [params, setParams] = useSearchParams();
  const inputs = useInsightsInputs();
  const now = inputs.data?.now ?? new Date();
  const weeks = lastWeeks(INSIGHT_WEEKS, now);
  const current = weekStartOf(now);
  const lastFull = addWeeks(current, -1);
  // The first week has no "week before" in the data: start one week later.
  const requested = params.get('week');
  const week = requested && weeks.slice(1).includes(requested) ? requested : lastFull;
  useDocumentTitle(`Pilot report ${weekLabel(week)}`);

  if (inputs.isPending) return <SkeletonDetail label="Loading the report" />;
  if (inputs.error) {
    return <Notice tone="error">Could not load the report: {inputs.error.message}</Notice>;
  }

  const r = weeklyReport(week, inputs.data);
  const go = (w: string) => setParams(w === lastFull ? {} : { week: w });

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/insights" className="text-sm underline">
          Back to insights
        </Link>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Week">
          <Button
            variant="ghost"
            aria-label="Previous week"
            disabled={week <= weeks[1]!}
            onClick={() => go(addWeeks(week, -1))}
          >
            ←
          </Button>
          <Button
            variant="ghost"
            aria-label="Next week"
            disabled={week >= current}
            onClick={() => go(addWeeks(week, 1))}
          >
            →
          </Button>
          <Button onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
      </div>

      <header className="flex flex-col gap-1">
        <span className="micro-label">AutoRafiki pilot · weekly report</span>
        <h1 className="text-xl font-semibold">
          {weekLabel(week)}
          {r.week.partial ? <span className="font-normal text-muted"> (so far)</span> : null}
        </h1>
        <p className="text-xs text-muted">
          Kampala time, Monday to Sunday. Prepared {formatDateTime(now.toISOString())} from the
          operations dashboard.
        </p>
      </header>

      <Section title="The numbers">
        <Headline w={r.week} p={r.previous} />
      </Section>

      <Section title="Mechanics">
        <p className="text-sm">
          {r.week.verified} verified · {r.week.newApplicants} new{' '}
          {r.week.newApplicants === 1 ? 'applicant' : 'applicants'} · {r.week.approvals}{' '}
          {r.week.approvals === 1 ? 'approval' : 'approvals'} · {r.week.suspensions}{' '}
          {r.week.suspensions === 1 ? 'suspension' : 'suspensions'}
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Most jobs this week</h3>
            {r.top.length === 0 ? (
              <p className="text-sm text-muted">No completed jobs.</p>
            ) : (
              <ol className="flex flex-col gap-1 text-sm">
                {r.top.map((s) => (
                  <li key={s.mechanic.userId} className="flex items-center gap-2">
                    <span aria-hidden className="diamond text-success" />
                    {s.mechanic.businessName}:{' '}
                    {s.weekly.find((w) => w.weekStart === week)?.completed ?? 0} completed
                    {s.rating.recent !== null ? `, ★ ${oneDp(s.rating.recent)}` : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Needing attention</h3>
            {r.concerns.length === 0 ? (
              <p className="text-sm text-muted">Nobody flagged.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {r.concerns.map((s) => (
                  <li key={s.mechanic.userId} className="flex items-center gap-2">
                    <span aria-hidden className="diamond text-warning" />
                    {s.mechanic.businessName}:{' '}
                    {s.signals
                      .filter((x) => x !== 'top')
                      .map((x) => SIGNAL_LABELS[x].toLowerCase())
                      .join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Six-week trend">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th scope="col" className="py-1.5 font-normal">
                  Week of
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Jobs per mechanic
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Arrival (median)
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Unanswered
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Collected
                </th>
              </tr>
            </thead>
            <tbody>
              {r.trend.map((t) => (
                <tr key={t.weekStart} className="border-b border-hairline last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {shortWeek(t.weekStart)}
                    {t.weekStart === week ? ' ◆' : ''}
                    {t.partial ? ' (so far)' : ''}
                  </th>
                  <td className="py-1.5">
                    {t.jobsPerMechanic === null ? '–' : oneDp(t.jobsPerMechanic)}
                  </td>
                  <td className="py-1.5">
                    {t.medianArrivalMin === null ? '–' : minutes(t.medianArrivalMin)}
                  </td>
                  <td className="py-1.5">
                    {t.unservedShare === null ? '–' : pct(t.unservedShare)}
                  </td>
                  <td className="py-1.5">{t.collected === null ? '–' : formatUgx(t.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted">◆ marks the week of this report.</p>
      </Section>

      <Section title="Where customers went unanswered (last 4 weeks)">
        {r.gaps.length === 0 ? (
          <p className="text-sm text-muted">Every finished request found a mechanic.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {r.gaps.map((a, i) => (
              <li key={a.key}>
                {i + 1}. {a.label}: {a.unserved} of {a.requests} unanswered
                {a.nearestMechanicKm !== null
                  ? `, nearest verified mechanic ${a.nearestMechanicKm.toFixed(1)} km away`
                  : ''}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </article>
  );
}

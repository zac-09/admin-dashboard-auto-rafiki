import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { useAttentionContext } from '@/app/useAttention';
import { AnimatedNumber, Reveal, staggerDelay } from '@/components/motion';
import { Skeleton, SkeletonLines } from '@/components/ui';
import { STATUS_LABELS } from '@/features/operations/board';
import { describeAlert } from '@/features/operations/notifications/plan';
import { useKpiInputs } from '@/features/revenue/hooks';
import { ARRIVAL_TARGET_MIN, computeKpis } from '@/features/revenue/kpis';
import { formatUgx } from '@/lib/format';
import { can, type Permission } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useSession } from '@/lib/session';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useLive, useNow } from '@/lib/useLive';
import type { HandoverNote, JobStatus } from '@/types';

import { greeting } from './greeting';

const DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const SHOWN = 5;
const IN_PROGRESS: readonly JobStatus[] = ['requested', 'matched', 'enroute', 'arrived', 'working'];

/** One "needs you" count, linking to where it is dealt with. Zero says so in words. */
function AttentionCard({
  index,
  label,
  count,
  context,
  clear,
  to,
  action,
}: {
  index: number;
  label: string;
  /** null while loading. */
  count: number | null;
  context?: string;
  clear: string;
  to: string;
  action: string;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 5)}
      className={`panel flex flex-col gap-2 p-5 ${count ? 'border-primary' : ''}`}
    >
      <h2 className="micro-label">{label}</h2>
      {count === null ? (
        <Skeleton className="h-9 w-12" />
      ) : (
        <span className="text-3xl font-light">
          <AnimatedNumber value={count} />
        </span>
      )}
      {count === 0 ? (
        <span className="flex items-center gap-2 text-xs text-muted">
          <span aria-hidden className="diamond text-success" />
          {clear}
        </span>
      ) : context ? (
        <span className="text-xs text-muted">{context}</span>
      ) : null}
      <Link to={to} className="mt-auto self-start text-sm font-semibold underline">
        {action}
      </Link>
    </Reveal>
  );
}

function Panel({
  index,
  label,
  link,
  children,
}: {
  index: number;
  label: string;
  link?: { to: string; text: string };
  children: ReactNode;
}) {
  return (
    <Reveal
      as="section"
      aria-label={label}
      delay={staggerDelay(index, 4)}
      className="panel flex min-w-0 flex-col gap-3 p-5"
    >
      <h2 className="micro-label flex items-center justify-between gap-3">
        <span>{label}</span>
        {link ? (
          <Link to={link.to} className="text-xs font-semibold normal-case underline">
            {link.text}
          </Link>
        ) : null}
      </h2>
      {children}
    </Reveal>
  );
}

function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm text-muted">
      <span aria-hidden className="diamond text-success" />
      {children}
    </p>
  );
}

function TopAlerts() {
  const { alerts } = useAttentionContext();
  if (!alerts) return <SkeletonLines lines={3} />;
  if (alerts.length === 0) return <AllClear>Nothing needs you right now.</AllClear>;
  return (
    <ul aria-label="Most urgent alerts" className="flex flex-col gap-3 text-sm">
      {alerts.slice(0, SHOWN).map((alert) => {
        const d = describeAlert(alert);
        return (
          <li key={alert.key} className="flex gap-3">
            <span aria-hidden className="mt-1.5 diamond sonar shrink-0 text-warning" />
            <Link to={d.path} className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{d.title}</span>
              <span className="truncate text-muted">{d.body}</span>
            </Link>
          </li>
        );
      })}
      {alerts.length > SHOWN ? (
        <li className="text-xs text-muted">and {alerts.length - SHOWN} more in the control room</li>
      ) : null}
    </ul>
  );
}

function OpenHandover() {
  const { handover } = useRepositories();
  const notes = useLive<HandoverNote[]>('handover', (next, fail) => handover.subscribe(next, fail));
  if (notes.status === 'loading') return <SkeletonLines lines={3} />;
  if (notes.status === 'error') return <p className="text-sm text-danger">Could not load notes.</p>;
  const open = notes.data.filter((n) => !n.handledAt);
  if (open.length === 0) return <AllClear>No open notes from the last shift.</AllClear>;
  return (
    <ul aria-label="Open handover notes" className="flex flex-col gap-3 text-sm">
      {open.slice(0, SHOWN).map((n) => (
        <li key={n.id} className="flex gap-3">
          <span aria-hidden className="mt-1.5 diamond shrink-0 text-accent" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{n.text}</span>
            <span className="text-xs text-muted">
              {n.authorEmail ?? 'Staff'}
              {n.jobId ? (
                <>
                  {' · '}
                  <Link to={`/jobs/${n.jobId}`} className="underline">
                    Job {n.jobId}
                  </Link>
                </>
              ) : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RightNow() {
  const { activeJobs, online } = useAttentionContext();
  if (!activeJobs || !online) return <SkeletonLines lines={2} />;
  const verifiedOnline = online.filter((m) => m.isOnline && m.vetting === 'verified').length;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      {IN_PROGRESS.map((status) => (
        <div key={status} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{STATUS_LABELS[status]}</dt>
          <dd className="text-xl font-light">
            <AnimatedNumber value={activeJobs.filter((j) => j.status === status).length} />
          </dd>
        </div>
      ))}
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Mechanics online</dt>
        <dd className="text-xl font-light">
          <AnimatedNumber value={verifiedOnline} />
        </dd>
      </div>
    </dl>
  );
}

function LastDay() {
  const inputs = useKpiInputs(7);
  const now = useNow(60_000);
  if (inputs.isPending) return <SkeletonLines lines={2} />;
  if (inputs.error) return <p className="text-sm text-danger">Could not load the numbers.</p>;
  const k = computeKpis(inputs.data.jobs, inputs.data.ratings, inputs.data.mechanics, 1, now);
  const arrival = k.medianArrivalMin;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Requests</dt>
        <dd className="text-xl font-light">{k.jobs}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Request to arrival</dt>
        <dd className="text-xl font-light">
          {arrival === null ? '–' : `${Math.round(arrival)} min`}
        </dd>
        {arrival === null ? null : (
          <dd className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              aria-hidden
              className={`size-2 rotate-45 ${arrival < ARRIVAL_TARGET_MIN ? 'bg-success' : 'bg-warning'}`}
            />
            {arrival < ARRIVAL_TARGET_MIN ? 'On target' : 'Over target'}
          </dd>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Accepted</dt>
        <dd className="text-xl font-light">
          {k.acceptanceRate === null ? '–' : `${Math.round(k.acceptanceRate * 100)}%`}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs text-muted">Completed</dt>
        <dd className="text-xl font-light">
          {k.completionRate === null ? '–' : `${Math.round(k.completionRate * 100)}%`}
        </dd>
      </div>
    </dl>
  );
}

/** Where each staff member starts: what needs them now, across the modules they can see. */
export function TodayPage() {
  useDocumentTitle('Today');
  const session = useSession();
  const now = useNow(60_000);
  const a = useAttentionContext();
  const may = (p: Permission) => can(session?.role, p);
  const name = session?.displayName?.split(' ')[0] ?? null;
  const owed = a.overdue?.reduce((sum, x) => sum + x.amount, 0) ?? 0;

  const cards = [
    may('operations.view') && {
      label: 'Open alerts',
      count: a.alerts?.length ?? null,
      clear: 'Nothing needs you right now',
      to: '/operations',
      action: 'Open the control room',
    },
    may('vetting.view') && {
      label: 'Applicants waiting',
      count: a.pending?.length ?? null,
      clear: 'No applications waiting',
      to: '/vetting',
      action: 'Review applicants',
    },
    may('support.view') && {
      label: 'Open disputes',
      count: a.openDisputes?.length ?? null,
      clear: 'No open disputes',
      to: '/support',
      action: 'See disputes',
    },
    may('revenue.view') && {
      label: 'Mechanics overdue',
      count: a.overdue?.length ?? null,
      context: `${formatUgx(owed)} to collect`,
      clear: 'Everyone has paid',
      to: '/revenue',
      action: 'Collect payments',
    },
  ].filter((c) => c !== false);

  return (
    <>
      <PageHeader
        label={DAY.format(now)}
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
      />
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c, i) => (
            <AttentionCard key={c.label} index={i} {...c} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {may('operations.view') ? (
            <Panel index={0} label="Most urgent" link={{ to: '/operations', text: 'All alerts' }}>
              <TopAlerts />
            </Panel>
          ) : null}
          {may('handover.write') ? (
            <Panel
              index={1}
              label="Shift handover"
              link={{ to: '/operations', text: 'Write a note' }}
            >
              <OpenHandover />
            </Panel>
          ) : null}
          {may('operations.view') ? (
            <Panel index={2} label="Right now" link={{ to: '/operations', text: 'Live board' }}>
              <RightNow />
            </Panel>
          ) : null}
          {may('revenue.view') ? (
            <Panel
              index={3}
              label="Last 24 hours"
              link={{ to: '/revenue?view=kpis', text: 'All KPIs' }}
            >
              <LastDay />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

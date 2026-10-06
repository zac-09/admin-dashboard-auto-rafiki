import { Link, useSearchParams } from 'react-router';

import { motion } from 'motion/react';

import { PageHeader } from '@/app/pages/PageHeader';
import { AnimatedNumber, Reveal, springs, staggerDelay } from '@/components/motion';
import { Notice, Skeleton, SkeletonTable } from '@/components/ui';
import { daysSince, formatDate } from '@/lib/format';
import type { VettingStatus } from '@/lib/vetting';
import type { AuditEntry, MechanicDoc } from '@/types';

import { auditEntryLabel } from './auditLabels';
import { useMechanicAudit, useVettingQueue } from './hooks';
import { byBusinessName, latestEntryByMechanic, reverificationDue } from './insights';
import { ratingText, servicesText, vehiclesText } from './mechanicText';
import { PhoneLink } from './PhoneLink';

type Queue = VettingStatus | 'reverify';

const QUEUES: { id: Queue; label: string; empty: string }[] = [
  { id: 'pending', label: 'Pending', empty: 'No applications waiting.' },
  { id: 'verified', label: 'Verified', empty: 'No verified mechanics yet.' },
  { id: 'suspended', label: 'Suspended', empty: 'Nobody is suspended.' },
  {
    id: 'reverify',
    label: 'Re-verification',
    empty: 'Every verified mechanic was assessed within the last 12 months.',
  },
];

function isQueue(value: string | null): value is Queue {
  return QUEUES.some((q) => q.id === value);
}

interface Row {
  mechanic: MechanicDoc;
  note: string;
}

function decisionNote(entry: AuditEntry | undefined): string | null {
  return entry ? `${auditEntryLabel(entry)} ${formatDate(entry.at)}: ${entry.reason}` : null;
}

function buildRows(
  queue: Queue,
  lists: Record<VettingStatus, MechanicDoc[]>,
  entries: AuditEntry[],
  now: Date,
): Row[] {
  const latest = latestEntryByMechanic(entries);
  if (queue === 'reverify') {
    return reverificationDue(lists.verified, entries, now).map(({ mechanic, lastVerifiedAt }) => ({
      mechanic,
      note: lastVerifiedAt
        ? `Last verified ${formatDate(lastVerifiedAt)} (${daysSince(lastVerifiedAt, now)} days ago)`
        : 'No verification on record (verified before the dashboard)',
    }));
  }
  return [...lists[queue]].sort(byBusinessName).map((mechanic) => {
    const entry = latest.get(mechanic.userId);
    const fallback = {
      pending: 'New application',
      verified: 'No verification on record',
      suspended: 'No suspension on record',
    }[queue];
    return { mechanic, note: decisionNote(entry) ?? fallback };
  });
}

export function VettingQueuePage() {
  const [params, setParams] = useSearchParams();
  const queue: Queue = isQueue(params.get('queue')) ? (params.get('queue') as Queue) : 'pending';
  const pending = useVettingQueue('pending');
  const verified = useVettingQueue('verified');
  const suspended = useVettingQueue('suspended');
  const audit = useMechanicAudit();

  const queries = [pending, verified, suspended, audit];
  const error = queries.find((q) => q.error)?.error;
  const loading = queries.some((q) => q.isPending);
  const lists = {
    pending: pending.data ?? [],
    verified: verified.data ?? [],
    suspended: suspended.data ?? [],
  };
  const now = new Date();
  const rowsFor = (q: Queue) => buildRows(q, lists, audit.data ?? [], now);
  const rows = rowsFor(queue);
  const current = QUEUES.find((q) => q.id === queue)!;

  return (
    <>
      <PageHeader label="Trust" title="Mechanic vetting" />
      <nav
        aria-label="Vetting queues"
        className="mb-4 flex flex-wrap gap-1 border-b border-hairline"
      >
        {QUEUES.map((q) => {
          const active = q.id === queue;
          return (
            <button
              key={q.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setParams(q.id === 'pending' ? {} : { queue: q.id })}
              className={`-mb-px flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm ${
                active
                  ? 'border-accent font-semibold text-primary'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              {q.label}
              {loading ? (
                <Skeleton className="h-2.5 w-4" />
              ) : (
                <span className="text-xs text-muted">
                  <AnimatedNumber value={rowsFor(q.id).length} />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {error ? <Notice tone="error">Could not load mechanics: {error.message}</Notice> : null}
      {loading ? (
        <SkeletonTable rows={5} columns={6} label="Loading mechanics" />
      ) : rows.length === 0 ? (
        <Reveal
          key={`empty-${queue}`}
          className="panel flex items-center gap-3 p-6 text-sm text-muted"
        >
          <span aria-hidden className="diamond text-accent" />
          {current.empty}
        </Reveal>
      ) : (
        <Reveal key={queue} from="fade" className="panel overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <caption className="sr-only">{current.label} mechanics</caption>
            <thead className="border-b border-hairline">
              <tr>
                {['Business', 'Services', 'Vehicles', 'Rating', 'Jobs', 'Status note'].map((h) => (
                  <th key={h} scope="col" className="micro-label px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ mechanic, note }, index) => (
                <motion.tr
                  key={mechanic.userId}
                  className="border-b border-hairline last:border-0"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.settle, delay: staggerDelay(index, rows.length) / 1000 }}
                >
                  <td className="px-3 py-2.5 align-top">
                    <Link to={`/vetting/${mechanic.userId}`} className="font-semibold underline">
                      {mechanic.businessName || 'Unnamed business'}
                    </Link>
                    <div className="text-xs">
                      <PhoneLink phone={mechanic.phone} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top">{servicesText(mechanic)}</td>
                  <td className="px-3 py-2.5 align-top">{vehiclesText(mechanic)}</td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap">
                    {ratingText(mechanic)}
                  </td>
                  <td className="px-3 py-2.5 align-top">{mechanic.jobsCompleted}</td>
                  <td className="max-w-xs px-3 py-2.5 align-top text-muted">{note}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      )}
    </>
  );
}

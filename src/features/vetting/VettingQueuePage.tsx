import type { MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { motion } from 'motion/react';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, springs, staggerDelay } from '@/components/motion';
import { Notice, SkeletonPanel, SkeletonTable, Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useIsDesktop } from '@/lib/useMediaQuery';
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
  // Pending: oldest application first (the app stamps createdAt on new mechanic profiles;
  // older profiles without it sort after, by name).
  const sorted =
    queue === 'pending'
      ? [...lists.pending].sort(
          (a, b) =>
            (a.createdAt ?? '\uffff').localeCompare(b.createdAt ?? '\uffff') ||
            byBusinessName(a, b),
        )
      : [...lists[queue]].sort(byBusinessName);
  return sorted.map((mechanic) => {
    const entry = latest.get(mechanic.userId);
    const fallback = {
      pending: mechanic.createdAt
        ? `New application · applied ${formatDate(mechanic.createdAt)}`
        : 'New application',
      verified: 'No verification on record',
      suspended: 'No suspension on record',
    }[queue];
    return { mechanic, note: decisionNote(entry) ?? fallback };
  });
}

export function VettingQueuePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  useDocumentTitle('Vetting');
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

  const openMechanic = (id: string) => (event: MouseEvent) => {
    // Whole rows and cards open the mechanic; real links inside (phone, name) keep their own job.
    if ((event.target as HTMLElement).closest('a')) return;
    navigate(`/vetting/${id}`);
  };

  return (
    <>
      <PageHeader label="Trust" title="Mechanic vetting" />
      <Tabs
        label="Vetting queues"
        value={queue}
        onChange={(id) => setParams(id === 'pending' ? {} : { queue: id })}
        items={QUEUES.map((q) => ({
          id: q.id,
          label: q.label,
          count: loading ? null : rowsFor(q.id).length,
        }))}
      />

      {error ? <Notice tone="error">Could not load mechanics: {error.message}</Notice> : null}
      {loading ? (
        isDesktop ? (
          <SkeletonTable rows={5} columns={6} label="Loading mechanics" />
        ) : (
          <div role="status" aria-label="Loading mechanics" className="flex flex-col gap-3">
            <SkeletonPanel lines={3} title={false} />
            <SkeletonPanel lines={3} title={false} />
          </div>
        )
      ) : rows.length === 0 ? (
        <Reveal
          key={`empty-${queue}`}
          className="panel flex items-center gap-3 p-6 text-sm text-muted"
        >
          <span aria-hidden className="diamond text-accent" />
          {current.empty}
        </Reveal>
      ) : isDesktop ? (
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
                  onClick={openMechanic(mechanic.userId)}
                  className="group cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-surface"
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
                  <td className="max-w-xs px-3 py-2.5 align-top text-muted">
                    <span className="flex items-start justify-between gap-3">
                      {note}
                      <span
                        aria-hidden
                        className="mt-0.5 shrink-0 text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                      >
                        →
                      </span>
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      ) : (
        // Phones: one card per mechanic instead of a sideways-scrolling table.
        <ul key={queue} className="flex flex-col gap-3" aria-label={`${current.label} mechanics`}>
          {rows.map(({ mechanic, note }, index) => (
            <Reveal
              as="li"
              key={mechanic.userId}
              delay={staggerDelay(index, rows.length)}
              onClick={openMechanic(mechanic.userId)}
              className="panel flex cursor-pointer flex-col gap-2 p-4 text-sm active:bg-surface"
            >
              <span className="flex items-start justify-between gap-3">
                <Link to={`/vetting/${mechanic.userId}`} className="font-semibold underline">
                  {mechanic.businessName || 'Unnamed business'}
                </Link>
                <span className="text-xs whitespace-nowrap text-muted">
                  {mechanic.jobsCompleted} jobs
                </span>
              </span>
              <span className="text-xs">
                <PhoneLink phone={mechanic.phone} />
              </span>
              <span>
                {servicesText(mechanic)} · {vehiclesText(mechanic)}
              </span>
              <span className="text-xs text-muted">{ratingText(mechanic)}</span>
              <span className="border-t border-hairline pt-2 text-xs text-muted">{note}</span>
            </Reveal>
          ))}
        </ul>
      )}
    </>
  );
}

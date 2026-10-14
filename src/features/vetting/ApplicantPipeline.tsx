import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonPanel } from '@/components/ui';
import { whatsappLink } from '@/features/revenue/collections';
import { useRepositories } from '@/lib/repositories';
import { summaryText } from '@/lib/vettingDocuments';
import type { AuditEntry, MechanicDoc } from '@/types';

import {
  applicantNudge,
  applicants,
  daysToApprove,
  STAGE_LABELS,
  type Applicant,
  type PipelineStage,
} from './pipeline';

const STAGES: PipelineStage[] = ['to-review', 'ready', 'needs-documents'];
const ACTION =
  'inline-flex min-h-10 items-center rounded-control border border-hairline px-3 text-sm font-semibold hover:border-primary';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function useStanding(pending: readonly MechanicDoc[]) {
  const { vettingDocuments } = useRepositories();
  const ids = pending.map((m) => m.userId).sort();
  return useQuery({
    queryKey: ['vetting', 'standing', ids],
    queryFn: async () =>
      new Map(
        await Promise.all(
          ids.map(async (id) => [id, await vettingDocuments.getStanding(id)] as const),
        ),
      ),
  });
}

function ApplicantRow({ a, index, count }: { a: Applicant; index: number; count: number }) {
  const phone = a.mechanic.phone;
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-col gap-2 border-b border-hairline px-4 py-3 text-sm last:border-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link to={`/vetting/${a.mechanic.userId}`} className="font-semibold underline">
          {a.mechanic.businessName || 'Unnamed business'}
        </Link>
        <span>
          {a.daysWaiting === null ? 'Applied (date unknown)' : `Waiting ${days(a.daysWaiting)}`}
        </span>
        <span className="text-xs text-muted">Documents: {summaryText(a.summary)}</span>
      </div>
      {a.stage === 'needs-documents' && phone ? (
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${phone}`} className={ACTION}>
            Call {phone}
          </a>
          <a
            href={whatsappLink(phone, applicantNudge(a))}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION}
          >
            WhatsApp nudge
          </a>
          <a href={`sms:${phone}?body=${encodeURIComponent(applicantNudge(a))}`} className={ACTION}>
            SMS nudge
          </a>
        </div>
      ) : null}
    </Reveal>
  );
}

/**
 * Applicants grouped by what blocks them: ops reviews documents, books assessments, and
 * nudges applicants who still owe documents. Oldest first within each group.
 */
export function ApplicantPipeline({
  pending,
  allMechanics,
  entries,
}: {
  pending: readonly MechanicDoc[];
  allMechanics: readonly MechanicDoc[];
  entries: readonly AuditEntry[];
}) {
  const standing = useStanding(pending);
  if (pending.length === 0) return null;
  if (standing.error) {
    return <Notice tone="error">Could not load documents: {standing.error.message}</Notice>;
  }
  if (standing.isPending) return <SkeletonPanel lines={3} />;

  const now = new Date();
  const list = applicants(pending, standing.data, now);
  const waits = list.flatMap((a) => (a.daysWaiting === null ? [] : [a.daysWaiting]));
  const approve = daysToApprove(allMechanics, entries, now);

  return (
    <section aria-label="Applicant pipeline" className="panel mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="micro-label">Applicant pipeline</h2>
        <p className="text-xs text-muted">
          {list.length} waiting
          {waits.length ? ` · oldest ${days(Math.max(...waits))}` : ''}
          {approve.median !== null
            ? ` · approval takes ${days(Math.round(approve.median))} (median of ${approve.count} in 90 days)`
            : ''}
        </p>
      </div>
      {STAGES.map((stage) => {
        const group = list.filter((a) => a.stage === stage);
        if (group.length === 0) return null;
        return (
          <div key={stage}>
            <h3 className="flex items-center gap-2 border-t border-hairline px-4 pt-3 pb-1 text-sm font-semibold">
              <span
                aria-hidden
                className={`diamond ${stage === 'needs-documents' ? 'text-warning' : 'text-accent'}`}
              />
              {STAGE_LABELS[stage]} ({group.length})
            </h3>
            <ul aria-label={STAGE_LABELS[stage]}>
              {group.map((a, i) => (
                <ApplicantRow key={a.mechanic.userId} a={a} index={i} count={group.length} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

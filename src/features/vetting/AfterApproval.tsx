import { Link } from 'react-router';

import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonPanel } from '@/components/ui';
import { useInsightsInputs } from '@/features/insights/hooks';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

import {
  medianDaysToFirstJob,
  RECRUIT_STAGE_LABELS,
  recentRecruits,
  type Recruit,
  type RecruitStage,
} from './recruits';

const ORDER: RecruitStage[] = ['never-online', 'unknown', 'online-no-job', 'first-job-done'];
const CONCERN: ReadonlySet<RecruitStage> = new Set(['never-online', 'unknown', 'online-no-job']);
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function Row({ r, index, count }: { r: Recruit; index: number; count: number }) {
  const session = useSession();
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline px-4 py-3 text-sm last:border-0"
    >
      <Link to={`/vetting/${r.mechanic.userId}`} className="font-semibold underline">
        {r.mechanic.businessName}
      </Link>
      <span>
        Approved {formatDate(r.approvedAt)} ({days(r.daysSinceApproval)} ago)
      </span>
      <span className="text-xs text-muted">
        {r.firstJobAt
          ? `First job ${formatDate(r.firstJobAt)}, ${days(Math.round(r.daysToFirstJob!))} after approval`
          : r.firstOnlineAt
            ? `First online ${formatDate(r.firstOnlineAt)}`
            : 'No completed job yet'}
      </span>
      {r.stage !== 'first-job-done' && can(session?.role, 'mechanics.message') ? (
        <Link to={`/messages?to=${r.mechanic.userId}`} className="text-xs underline">
          Message them
        </Link>
      ) : null}
    </Reveal>
  );
}

/** Newly approved mechanics: are they getting going, or dropping off after vetting? */
export function AfterApproval() {
  const inputs = useInsightsInputs();
  if (inputs.error) {
    return <Notice tone="error">Could not load recent approvals: {inputs.error.message}</Notice>;
  }
  if (inputs.isPending) return <SkeletonPanel lines={3} />;
  const { mechanics, entries, jobs, presence, now } = inputs.data;
  const recruits = recentRecruits(mechanics, entries, jobs, presence.availability, now);
  if (recruits.length === 0) return null;
  const medianDays = medianDaysToFirstJob(recruits);
  const done = recruits.filter((r) => r.stage === 'first-job-done').length;
  return (
    <section aria-label="After approval" className="panel mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="micro-label">After approval (last 60 days)</h2>
        <p className="text-xs text-muted">
          {done} of {recruits.length} have done a first job
          {medianDays !== null ? ` · median ${days(Math.round(medianDays))} to get there` : ''}
        </p>
      </div>
      {ORDER.map((stage) => {
        const group = recruits.filter((r) => r.stage === stage);
        if (group.length === 0) return null;
        return (
          <div key={stage}>
            <h3 className="flex items-center gap-2 border-t border-hairline px-4 pt-3 pb-1 text-sm font-semibold">
              <span
                aria-hidden
                className={`diamond ${CONCERN.has(stage) ? 'text-warning' : 'text-success'}`}
              />
              {RECRUIT_STAGE_LABELS[stage]} ({group.length})
            </h3>
            <ul aria-label={RECRUIT_STAGE_LABELS[stage]}>
              {group.map((r, i) => (
                <Row key={r.mechanic.userId} r={r} index={i} count={group.length} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

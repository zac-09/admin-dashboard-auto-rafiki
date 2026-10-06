import { useState, type FormEvent } from 'react';

import { SuccessMoment } from '@/components/motion';
import { Button, Notice, SkeletonLines } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import {
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_OUTCOMES,
  MAX_NOTE,
  type Dispute,
  type DisputeOutcome,
} from '@/types';

import { useDispute, useFlagDispute, useResolveDispute } from './hooks';

type Moment = { status: 'pending' | 'success'; title: string; subtitle?: string } | null;

function FlagForm({ jobId, onMoment }: { jobId: string; onMoment: (m: Moment) => void }) {
  const flag = useFlagDispute(jobId);
  const [reason, setReason] = useState('');
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    onMoment({ status: 'pending', title: '' });
    try {
      await flag.mutateAsync(reason.trim());
      onMoment({
        status: 'success',
        title: 'Dispute flagged',
        subtitle: 'It is on the open disputes list',
      });
      setReason('');
    } catch {
      onMoment(null);
    }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-label="Flag a dispute">
      <p className="text-sm text-muted">No dispute on this job.</p>
      <label htmlFor={`dispute-${jobId}`} className="micro-label">
        What is disputed
      </label>
      <textarea
        id={`dispute-${jobId}`}
        rows={2}
        maxLength={MAX_NOTE}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-control border border-hairline bg-background px-3 py-2 text-sm"
      />
      {flag.error ? <Notice tone="error">{flag.error.message}</Notice> : null}
      <Button
        id={`flag-${jobId}`}
        type="submit"
        variant="secondary"
        disabled={!reason.trim() || flag.isPending}
        hint={reason.trim() ? null : 'Describe the complaint first'}
      >
        Flag a dispute
      </Button>
    </form>
  );
}

function ResolveForm({ dispute, onMoment }: { dispute: Dispute; onMoment: (m: Moment) => void }) {
  const session = useSession();
  const resolve = useResolveDispute(dispute.jobId);
  const [outcome, setOutcome] = useState<DisputeOutcome | null>(null);
  const [note, setNote] = useState('');
  const canSuspend = can(session?.role, 'vetting.decide');
  const options = DISPUTE_OUTCOMES.filter((o) => o !== 'mechanic-suspended' || dispute.mechanicId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!outcome) return;
    onMoment({ status: 'pending', title: '' });
    try {
      await resolve.mutateAsync({ outcome, note: note.trim() });
      onMoment({
        status: 'success',
        title: 'Dispute resolved',
        subtitle:
          outcome === 'mechanic-suspended'
            ? 'Mechanic suspended: no new jobs'
            : DISPUTE_OUTCOME_LABELS[outcome],
      });
    } catch {
      onMoment(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Resolve the dispute">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="micro-label mb-1.5">Outcome</legend>
        {options.map((o) => {
          const locked = o === 'mechanic-suspended' && !canSuspend;
          return (
            <label
              key={o}
              className={`flex min-h-10 items-center gap-3 rounded-control border border-hairline px-3 text-sm has-[:checked]:border-primary ${
                locked ? 'cursor-not-allowed text-muted' : 'cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name={`outcome-${dispute.jobId}`}
                value={o}
                disabled={locked}
                checked={outcome === o}
                onChange={() => setOutcome(o)}
              />
              <span className="flex flex-col">
                {DISPUTE_OUTCOME_LABELS[o]}
                {locked ? <span className="text-xs">Needs an admin or ops role</span> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <label htmlFor={`resolve-${dispute.jobId}`} className="micro-label">
        Resolution note
      </label>
      <textarea
        id={`resolve-${dispute.jobId}`}
        rows={2}
        maxLength={MAX_NOTE}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-control border border-hairline bg-background px-3 py-2 text-sm"
      />
      {resolve.error ? <Notice tone="error">{resolve.error.message}</Notice> : null}
      <Button
        id={`resolve-btn-${dispute.jobId}`}
        type="submit"
        disabled={!outcome || !note.trim() || resolve.isPending}
        hint={!outcome ? 'Choose an outcome' : !note.trim() ? 'Add a resolution note' : null}
      >
        Resolve dispute
      </Button>
    </form>
  );
}

/** The job's dispute: flag one, see it open, resolve it with an outcome. */
export function DisputePanel({ jobId }: { jobId: string }) {
  const session = useSession();
  const live = useDispute(jobId);
  const [moment, setMoment] = useState<Moment>(null);
  const canAct = can(session?.role, 'support.annotate');

  const overlay = moment ? (
    <SuccessMoment
      status={moment.status}
      pendingTitle="Saving…"
      title={moment.title}
      subtitle={moment.subtitle}
      onDone={() => setMoment(null)}
    />
  ) : null;

  if (live.status === 'loading') return <SkeletonLines lines={2} />;
  if (live.status === 'error') {
    return <Notice tone="error">Could not load the dispute: {live.error.message}</Notice>;
  }
  const d = live.data;
  return (
    <div className="flex flex-col gap-4">
      {overlay}
      {d ? (
        <div className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className={`diamond ${d.status === 'open' ? 'sonar text-warning' : 'text-success'}`}
            />
            {d.status === 'open' ? 'Open dispute' : 'Resolved'}
          </span>
          <span>{d.reason}</span>
          <span className="text-xs text-muted">
            Opened by {d.openedByEmail ?? d.openedBy} · {formatDateTime(d.openedAt)}
          </span>
          {d.resolution ? (
            <span className="mt-2 flex flex-col gap-0.5 border-t border-hairline pt-2">
              <span className="font-semibold">{DISPUTE_OUTCOME_LABELS[d.resolution.outcome]}</span>
              <span>{d.resolution.note}</span>
              <span className="text-xs text-muted">
                {d.resolution.resolvedByEmail ?? d.resolution.resolvedBy} ·{' '}
                {formatDateTime(d.resolution.resolvedAt)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {!canAct ? null : d?.status === 'open' ? (
        <ResolveForm dispute={d} onMoment={setMoment} />
      ) : (
        <FlagForm jobId={jobId} onMoment={setMoment} />
      )}
    </div>
  );
}

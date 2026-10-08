import { useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';

import { springs, SuccessMoment } from '@/components/motion';
import { Button, Notice } from '@/components/ui';
import { useAppSettings } from '@/features/settings/hooks';
import { canAdminCancel, canRebroadcast, rebroadcastOptions } from '@/lib/interventions';
import { useRepositories } from '@/lib/repositories';
import { MAX_REASON } from '@/lib/vetting';
import type { Job, MechanicDoc } from '@/types';

import { SuspendMechanicForm } from './SuspendMechanicForm';

type Moment = { status: 'pending' | 'success'; title: string; subtitle: string } | null;

function Reason({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="micro-label">Reason (kept in the audit log)</span>
      <textarea
        id={id}
        rows={2}
        maxLength={MAX_REASON}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-control border border-hairline bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function Expand({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={springs.settle}
    >
      {children}
    </motion.div>
  );
}

function RebroadcastForm({ job, onMoment }: { job: Job; onMoment: (m: Moment) => void }) {
  const { operations } = useRepositories();
  const settings = useAppSettings().effective?.settings;
  const { hash } = useLocation();
  const [open, setOpen] = useState(hash === '#rebroadcast');
  const options = rebroadcastOptions(job.radiusKm, settings?.broadcast.expandedRadiusKm ?? 8);
  const [radius, setRadius] = useState<number | null>(
    options.find((km) => km > job.radiusKm) ?? null,
  );
  const [reason, setReason] = useState('');
  const run = useMutation({
    mutationFn: () => operations.rebroadcastJob(job.id, radius!, reason.trim()),
  });

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Widen the search
      </Button>
    );
  }
  const missing = radius === null ? 'Choose a radius' : !reason.trim() ? 'Add a reason' : null;
  const windowS = (settings?.broadcast.windowMs ?? 90_000) / 1000;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (missing || radius === null) return;
    const wider = radius > job.radiusKm;
    onMoment({ status: 'pending', title: '', subtitle: '' });
    try {
      await run.mutateAsync();
      onMoment({
        status: 'success',
        title: wider ? 'Search widened' : 'Broadcast renewed',
        subtitle: wider
          ? `Mechanics between ${job.radiusKm} and ${radius} km are alerted now`
          : `Everyone within ${radius} km is alerted again`,
      });
      setOpen(false);
      setReason('');
    } catch {
      onMoment(null);
    }
  }

  return (
    <Expand>
      <form
        id="rebroadcast"
        onSubmit={onSubmit}
        aria-label="Widen the search"
        className="flex flex-col gap-3"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="micro-label mb-2">Broadcast radius (now {job.radiusKm} km)</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((km) => (
              <label
                key={km}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-hairline px-3 text-sm has-[:checked]:border-primary has-[:checked]:font-semibold"
              >
                <input
                  type="radio"
                  name={`radius-${job.id}`}
                  checked={radius === km}
                  onChange={() => setRadius(km)}
                />
                {km} km{km === job.radiusKm ? ' (renew)' : ''}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-muted">
          Opens a fresh {windowS}-second window. Wider: only mechanics in the new outer band are
          alerted (the rest already were). Renew: everyone in range is alerted again.
        </p>
        <Reason id={`rebroadcast-reason-${job.id}`} value={reason} onChange={setReason} />
        {run.error ? <Notice tone="error">{run.error.message}</Notice> : null}
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            id={`rebroadcast-${job.id}`}
            type="submit"
            disabled={!!missing || run.isPending}
            hint={missing}
          >
            {radius !== null && radius > job.radiusKm ? `Widen to ${radius} km` : 'Renew broadcast'}
          </Button>
        </div>
      </form>
    </Expand>
  );
}

function CancelForm({ job, onMoment }: { job: Job; onMoment: (m: Moment) => void }) {
  const { operations } = useRepositories();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const run = useMutation({ mutationFn: () => operations.cancelJob(job.id, reason.trim()) });

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Cancel this job
      </Button>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    onMoment({ status: 'pending', title: '', subtitle: '' });
    try {
      await run.mutateAsync();
      onMoment({
        status: 'success',
        title: 'Job cancelled',
        subtitle: 'The customer and mechanic see “Cancelled by AutoRafiki support”',
      });
    } catch {
      onMoment(null);
    }
  }

  return (
    <Expand>
      <form onSubmit={onSubmit} aria-label="Cancel this job" className="flex flex-col gap-3">
        <p className="text-sm">
          This cannot be undone. The customer{job.mechanicId ? ' and the mechanic' : ''} get a
          notification that AutoRafiki support cancelled it.
        </p>
        <Reason id={`cancel-reason-${job.id}`} value={reason} onChange={setReason} />
        {run.error ? <Notice tone="error">{run.error.message}</Notice> : null}
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep the job
          </Button>
          <Button
            id={`cancel-${job.id}`}
            type="submit"
            variant="danger"
            disabled={!reason.trim() || run.isPending}
            hint={reason.trim() ? null : 'Add a reason'}
          >
            Cancel job for the customer
          </Button>
        </div>
      </form>
    </Expand>
  );
}

/** Ops interventions on one job; each is an audited Cloud Function. */
export function InterventionsPanel({
  job,
  mechanic,
}: {
  job: Job;
  mechanic: MechanicDoc | null | undefined;
}) {
  const [moment, setMoment] = useState<Moment>(null);
  const cancellable = canAdminCancel(job.status);
  const rebroadcastable = canRebroadcast(job);
  return (
    <div className="flex flex-col gap-5">
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Working…"
          title={moment.title}
          subtitle={moment.subtitle}
          onDone={() => setMoment(null)}
        />
      ) : null}
      {rebroadcastable ? <RebroadcastForm job={job} onMoment={setMoment} /> : null}
      {mechanic ? <SuspendMechanicForm mechanic={mechanic} jobId={job.id} /> : null}
      {cancellable ? <CancelForm job={job} onMoment={setMoment} /> : null}
      {!cancellable && !rebroadcastable && !mechanic ? (
        <p className="text-sm text-muted">Nothing to do on a job that is {job.status}.</p>
      ) : null}
    </div>
  );
}

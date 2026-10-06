import { useState, type FormEvent } from 'react';

import { Button, Notice } from '@/components/ui';
import { useDecideVetting } from '@/features/vetting/hooks';
import { MAX_REASON, nextVetting } from '@/lib/vetting';
import type { MechanicDoc } from '@/types';

/** Suspend from the control room: the same audited decideVetting call as the vetting page. */
export function SuspendMechanicForm({ mechanic, jobId }: { mechanic: MechanicDoc; jobId: string }) {
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const mutation = useDecideVetting();

  if (done || mechanic.vetting === 'suspended') {
    return (
      <p className="text-sm">
        {mechanic.businessName} is suspended and receives no new job broadcasts.
      </p>
    );
  }
  if (!nextVetting(mechanic.vetting, 'suspend')) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({
        mechanicId: mechanic.userId,
        decision: 'suspend',
        reason: `${reason.trim()} (job ${jobId})`,
      });
      setDone(true);
    } catch {
      // Shown from mutation.error.
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Suspend mechanic">
      <p className="text-xs text-muted">
        Stops new job broadcasts to {mechanic.businessName}. This job is not changed. The job id is
        added to the reason in the audit log.
      </p>
      <label htmlFor="suspend-reason" className="micro-label">
        Reason (required)
      </label>
      <textarea
        id="suspend-reason"
        rows={3}
        required
        maxLength={MAX_REASON - 40}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-control border border-hairline bg-background px-3 py-2 text-sm"
      />
      {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
      <Button type="submit" variant="secondary" disabled={!reason.trim() || mutation.isPending}>
        {mutation.isPending ? 'Suspending…' : `Suspend ${mechanic.businessName}`}
      </Button>
    </form>
  );
}

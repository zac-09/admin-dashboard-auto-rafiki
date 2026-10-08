import { useState, type FormEvent } from 'react';

import { Button, Notice } from '@/components/ui';
import { MAX_REASON } from '@/lib/vetting';
import type { SubscriptionPayment } from '@/types';

import { useVoidPayment } from './hooks';

/** Marks a recorded payment as a mistake. The record stays; the week counts as unpaid again. */
export function VoidPaymentForm({
  payment,
  onStart,
  onDone,
  onFailed,
  onCancel,
}: {
  payment: SubscriptionPayment;
  onStart: () => void;
  onDone: () => void;
  onFailed: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const run = useVoidPayment();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    onStart();
    try {
      await run.mutateAsync({ paymentId: payment.id, reason: reason.trim() });
      onDone();
    } catch {
      onFailed();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Void this payment"
      className="flex flex-col gap-3 rounded-control border border-hairline bg-surface p-3"
    >
      <p className="text-sm">
        The record is kept with your reason, the week goes back to unpaid, and a correct payment can
        be recorded.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="micro-label">Why it was a mistake (kept in the audit log)</span>
        <input
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
        />
      </label>
      {run.error ? <Notice tone="error">{run.error.message}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Keep it
        </Button>
        <Button type="submit" variant="danger" disabled={!reason.trim() || run.isPending}>
          Void this payment
        </Button>
      </div>
    </form>
  );
}

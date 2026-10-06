import { useState, type FormEvent } from 'react';

import { Button, Notice } from '@/components/ui';
import { WEEKLY_FEE } from '@/lib/subscriptions';
import { formatUgx } from '@/lib/format';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type MechanicDoc,
  type PaymentMethod,
} from '@/types';

import { useMarkPaid } from './hooks';

export function MarkPaidForm({
  mechanic,
  weekStart,
  onStart,
  onDone,
  onFailed,
  onCancel,
}: {
  mechanic: MechanicDoc;
  weekStart: string;
  onStart: () => void;
  onDone: () => void;
  onFailed: () => void;
  onCancel: () => void;
}) {
  const mark = useMarkPaid();
  const [method, setMethod] = useState<PaymentMethod>('mobile-money');
  const [reference, setReference] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    onStart();
    try {
      await mark.mutateAsync({ mechanicId: mechanic.userId, weekStart, method, reference });
      onDone();
    } catch {
      onFailed();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label={`Record payment for ${mechanic.businessName}`}
      className="flex flex-col gap-3 rounded-control border border-hairline bg-surface p-3"
    >
      <fieldset className="flex flex-wrap gap-2">
        <legend className="micro-label mb-2">Paid by</legend>
        {PAYMENT_METHODS.map((m) => (
          <label
            key={m}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-hairline bg-background px-3 text-sm has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name={`method-${mechanic.userId}`}
              checked={method === m}
              onChange={() => setMethod(m)}
            />
            {PAYMENT_METHOD_LABELS[m]}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="micro-label">Reference (optional)</span>
        <input
          value={reference}
          maxLength={120}
          onChange={(e) => setReference(e.target.value)}
          placeholder={method === 'mobile-money' ? 'Transaction id' : 'Receipt number'}
          className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm placeholder:text-muted"
        />
      </label>
      {mark.error ? <Notice tone="error">{mark.error.message}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mark.isPending}>
          Record {formatUgx(WEEKLY_FEE)} paid
        </Button>
      </div>
    </form>
  );
}

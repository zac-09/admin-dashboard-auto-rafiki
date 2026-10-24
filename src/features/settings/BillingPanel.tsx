import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button, Notice, SkeletonLines } from '@/components/ui';
import { checkPayTo, NETWORKS, PAY_TO_LIMITS, payToLine, type PayTo } from '@/lib/billing';
import { can } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useSession } from '@/lib/session';
import { useLive } from '@/lib/useLive';
import { MAX_REASON } from '@/lib/vetting';
import { toast } from '@/components/toast/toastStore';

type Row = { network: (typeof NETWORKS)[number]; number: string; name: string };
const FIELD = 'min-h-10 rounded-control border bg-background px-3 text-sm';

function Editor({ current, onDone }: { current: PayTo | null; onDone: () => void }) {
  const { settings } = useRepositories();
  const [rows, setRows] = useState<Row[]>(
    current?.numbers.map((n) => ({ ...n })) ?? [{ network: 'MTN', number: '', name: '' }],
  );
  const [note, setNote] = useState(current?.note ?? '');
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => settings.publishBilling({ numbers: rows, note }, reason.trim()),
    onSuccess: () => {
      toast({
        title: 'Payment numbers saved',
        body: 'Overdue reminders and the app now show them.',
        link: { to: '/audit?action=billing.update', label: 'View in audit log' },
      });
      onDone();
    },
  });
  const check = checkPayTo({ numbers: rows, note });
  const errors = check.ok ? {} : check.errors;
  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const missing = !check.ok
    ? 'Fix the highlighted fields'
    : !reason.trim()
      ? 'Add a reason for the audit log'
      : null;
  return (
    <form
      aria-label="Edit payment numbers"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!missing) save.mutate();
      }}
    >
      <ul className="flex flex-col gap-2" aria-label="Numbers">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-start gap-2">
            <select
              aria-label={`Network ${i + 1}`}
              value={r.network}
              onChange={(e) => set(i, { network: e.target.value as Row['network'] })}
              className={`${FIELD} border-hairline`}
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="flex flex-col gap-1">
              <input
                aria-label={`Number ${i + 1}`}
                value={r.number}
                inputMode="tel"
                placeholder="0772 123 456"
                aria-invalid={!!errors[`numbers.${i}.number`]}
                onChange={(e) => set(i, { number: e.target.value })}
                className={`${FIELD} w-40 ${errors[`numbers.${i}.number`] ? 'border-danger' : 'border-hairline'}`}
              />
              {errors[`numbers.${i}.number`] ? (
                <span className="text-xs text-danger">{errors[`numbers.${i}.number`]}</span>
              ) : null}
            </span>
            <span className="flex flex-col gap-1">
              <input
                aria-label={`Registered name ${i + 1}`}
                value={r.name}
                maxLength={PAY_TO_LIMITS.name}
                placeholder="Name shown when paying"
                aria-invalid={!!errors[`numbers.${i}.name`]}
                onChange={(e) => set(i, { name: e.target.value })}
                className={`${FIELD} w-52 ${errors[`numbers.${i}.name`] ? 'border-danger' : 'border-hairline'}`}
              />
              {errors[`numbers.${i}.name`] ? (
                <span className="text-xs text-danger">{errors[`numbers.${i}.name`]}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              className="min-h-10 text-xs text-muted underline hover:text-primary"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {rows.length < PAY_TO_LIMITS.numbers ? (
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { network: 'Airtel', number: '', name: '' }])}
          className="min-h-10 self-start text-sm underline"
        >
          Add a number
        </button>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Note shown with the numbers (optional)
        <input
          value={note}
          maxLength={PAY_TO_LIMITS.note}
          placeholder="Use your phone number as the reference."
          onChange={(e) => setNote(e.target.value)}
          className={`${FIELD} border-hairline`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Reason (kept in the audit log)
        <input
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          className={`${FIELD} border-hairline`}
        />
      </label>
      {rows.length === 0 ? (
        <p className="text-xs text-warning">
          Saving with no numbers clears them: mechanics will see no payment details.
        </p>
      ) : null}
      {save.error ? <Notice tone="error">{save.error.message}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!!missing || save.isPending}
          loading={save.isPending}
          hint={missing}
        >
          {save.isPending ? 'Saving…' : 'Save numbers'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Where mechanics send their weekly UGX 15,000 (shown on the app's subscription screen). */
export function BillingPanel() {
  const { settings } = useRepositories();
  const session = useSession();
  const canEdit = can(session?.role, 'settings.edit');
  const live = useLive<PayTo | null>('settings-billing', (n, f) => settings.subscribeBilling(n, f));
  const [editing, setEditing] = useState(false);
  return (
    <section aria-label="Subscription payments (shown in the app)" className="panel p-5">
      <h2 className="micro-label mb-3">Subscription payments (shown in the app)</h2>
      {live.status === 'loading' ? (
        <SkeletonLines lines={2} />
      ) : live.status === 'error' ? (
        <Notice tone="error">Could not load payment numbers: {live.error.message}</Notice>
      ) : editing ? (
        <Editor current={live.data} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          {live.data ? (
            <>
              <ul className="flex flex-col gap-1">
                {live.data.numbers.map((n) => (
                  <li key={n.number}>{payToLine(n)}</li>
                ))}
              </ul>
              {live.data.note ? <p className="text-muted">{live.data.note}</p> : null}
            </>
          ) : (
            <p className="text-warning">
              <span aria-hidden className="diamond mr-2" />
              No mobile money number set: mechanics see what they owe but not where to pay.
            </p>
          )}
          {canEdit ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {live.data ? 'Change numbers' : 'Set payment numbers'}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

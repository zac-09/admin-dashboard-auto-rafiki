import { useState } from 'react';
import { Link } from 'react-router';

import { Reveal, staggerDelay } from '@/components/motion';
import type { PayTo } from '@/lib/billing';
import { formatUgx } from '@/lib/format';
import { useRepositories } from '@/lib/repositories';
import { useLive } from '@/lib/useLive';
import { weekLabel } from '@/lib/subscriptions';

import {
  reminderMessage,
  suspensionSuggested,
  whatsappLink,
  type OverdueAccount,
} from './collections';

const ACTION =
  'inline-flex min-h-10 items-center rounded-control border border-hairline px-3 text-sm font-semibold hover:border-primary';

function CopyMessage({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className={ACTION}
      onClick={() => {
        if (!navigator.clipboard) {
          setState('failed');
          return;
        }
        navigator.clipboard.writeText(text).then(
          () => setState('copied'),
          () => setState('failed'),
        );
      }}
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy blocked' : 'Copy message'}
      </span>
    </button>
  );
}

function Account({
  account,
  payTo,
  index,
  count,
}: {
  account: OverdueAccount;
  payTo: PayTo | null;
  index: number;
  count: number;
}) {
  const { mechanic, weeks, amount } = account;
  const message = reminderMessage(account, payTo);
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-col gap-2 border-b border-hairline px-4 py-3 last:border-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link to={`/support/people/${mechanic.userId}`} className="font-semibold underline">
          {mechanic.businessName}
        </Link>
        <span className="text-sm">
          {formatUgx(amount)} · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'} overdue
        </span>
        <span className="text-xs text-muted">{weeks.map(weekLabel).join(' · ')}</span>
        {suspensionSuggested(account) && mechanic.vetting === 'verified' ? (
          <Link
            to={`/vetting/${mechanic.userId}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-warning px-2 py-0.5 text-xs font-semibold"
          >
            <span aria-hidden className="diamond text-warning" />
            Suspension suggested: review
          </Link>
        ) : null}
      </div>
      {mechanic.phone ? (
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${mechanic.phone}`} className={ACTION}>
            Call {mechanic.phone}
          </a>
          <a
            href={whatsappLink(mechanic.phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION}
          >
            WhatsApp reminder
          </a>
          <a href={`sms:${mechanic.phone}?body=${encodeURIComponent(message)}`} className={ACTION}>
            SMS reminder
          </a>
          <CopyMessage text={message} />
        </div>
      ) : (
        <span className="text-xs text-muted">No phone on the mechanic's profile.</span>
      )}
    </Reveal>
  );
}

/** Who to chase today, across every week, with a ready-made reminder. */
export function OverduePanel({ accounts }: { accounts: readonly OverdueAccount[] }) {
  const { settings } = useRepositories();
  const billing = useLive<PayTo | null>('settings-billing', (n, f) =>
    settings.subscribeBilling(n, f),
  );
  const payTo = billing.data ?? null;
  const total = accounts.reduce((n, a) => n + a.amount, 0);
  return (
    <section aria-label="Overdue payments" className="panel">
      <h2 className="micro-label flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <span>To collect</span>
        {accounts.length > 0 ? (
          <span className="normal-case">
            {formatUgx(total)} from {accounts.length}{' '}
            {accounts.length === 1 ? 'mechanic' : 'mechanics'}
          </span>
        ) : null}
      </h2>
      {accounts.length === 0 ? (
        <p className="flex items-center gap-3 px-4 pb-4 text-sm text-muted">
          <span aria-hidden className="diamond text-success" />
          Nobody is overdue.
        </p>
      ) : (
        <ul aria-label="Mechanics to remind">
          {accounts.map((a, i) => (
            <Account
              key={a.mechanic.userId}
              account={a}
              payTo={payTo}
              index={i}
              count={accounts.length}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

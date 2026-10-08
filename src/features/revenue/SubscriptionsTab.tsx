import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AnimatedNumber, Reveal, springs, staggerDelay, SuccessMoment } from '@/components/motion';
import { Button, Notice, SkeletonPanel, SkeletonTable } from '@/components/ui';
import { PhoneLink } from '@/features/vetting/PhoneLink';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatUgx } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import {
  addWeeks,
  summarizeWeek,
  TRACKING_START,
  weekLabel,
  weeksBetween,
  weekStartOf,
  WEEKLY_FEE,
  type MechanicWeek,
} from '@/lib/subscriptions';
import { PAYMENT_METHOD_LABELS } from '@/types';

import { subscriptionsCsv } from './exports';
import { useSubscriptionInputs } from './hooks';
import { MarkPaidForm } from './MarkPaidForm';
import { VoidPaymentForm } from './VoidPaymentForm';
import { SubscriptionStatus } from './StatusBadge';

type Moment = { status: 'pending' | 'success'; title: string; subtitle: string } | null;

function Row({
  row,
  weekStart,
  index,
  count,
  canMark,
  onMoment,
}: {
  row: MechanicWeek;
  weekStart: string;
  index: number;
  count: number;
  canMark: boolean;
  onMoment: (m: Moment) => void;
}) {
  const [open, setOpen] = useState<'pay' | 'void' | null>(null);
  const { mechanic, payment, status, unpaidEarlier } = row;
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-col gap-3 border-b border-hairline px-4 py-3 last:border-0"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex min-w-48 flex-1 flex-col">
          <Link to={`/support/people/${mechanic.userId}`} className="font-semibold underline">
            {mechanic.businessName}
          </Link>
          <span className="text-xs">
            <PhoneLink phone={mechanic.phone} />
          </span>
        </span>
        <SubscriptionStatus status={status} />
        <span className="min-w-40 text-xs text-muted">
          {payment
            ? `${PAYMENT_METHOD_LABELS[payment.method]}${payment.reference ? ` · ${payment.reference}` : ''} · ${formatDateTime(payment.paidAt)}`
            : unpaidEarlier.length > 0
              ? `${unpaidEarlier.length} earlier ${unpaidEarlier.length === 1 ? 'week' : 'weeks'} unpaid`
              : 'No arrears'}
        </span>
        {canMark && !payment && !open ? (
          <Button variant="secondary" onClick={() => setOpen('pay')}>
            Mark paid
          </Button>
        ) : null}
        {canMark && payment && !open ? (
          <button
            type="button"
            onClick={() => setOpen('void')}
            className="min-h-10 text-xs text-muted underline hover:text-primary"
          >
            Void…
          </button>
        ) : null}
      </div>
      {open === 'void' && payment ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={springs.settle}
        >
          <VoidPaymentForm
            payment={payment}
            onCancel={() => setOpen(null)}
            onStart={() => onMoment({ status: 'pending', subtitle: '', title: 'Payment voided' })}
            onFailed={() => onMoment(null)}
            onDone={() => {
              setOpen(null);
              onMoment({
                status: 'success',
                title: 'Payment voided',
                subtitle: `${mechanic.businessName} · ${weekLabel(weekStart)} is unpaid again`,
              });
            }}
          />
        </motion.div>
      ) : null}
      {open === 'pay' ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={springs.settle}
        >
          <MarkPaidForm
            mechanic={mechanic}
            weekStart={weekStart}
            onCancel={() => setOpen(null)}
            onStart={() => onMoment({ status: 'pending', subtitle: '', title: 'Payment recorded' })}
            onFailed={() => onMoment(null)}
            onDone={() => {
              setOpen(null);
              onMoment({
                status: 'success',
                title: 'Payment recorded',
                subtitle: `${formatUgx(WEEKLY_FEE)} · ${mechanic.businessName} · ${weekLabel(weekStart)}`,
              });
            }}
          />
        </motion.div>
      ) : null}
    </Reveal>
  );
}

export function SubscriptionsTab() {
  const session = useSession();
  const inputs = useSubscriptionInputs();
  const now = new Date();
  const current = weekStartOf(now);
  const [week, setWeek] = useState(current);
  const [moment, setMoment] = useState<Moment>(null);

  if (inputs.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonPanel lines={2} />
        <SkeletonTable rows={4} columns={4} label="Loading subscriptions" />
      </div>
    );
  }
  if (inputs.error) {
    return <Notice tone="error">Could not load subscriptions: {inputs.error.message}</Notice>;
  }

  const { mechanics, entries, payments } = inputs.data;
  const summary = summarizeWeek(week, mechanics, entries, payments, now);
  const arrears = summarizeWeek(current, mechanics, entries, payments, now).rows.reduce(
    (n, r) => n + r.unpaidEarlier.length + (r.status === 'paid' ? 0 : 1),
    0,
  );
  const progress = summary.expected ? summary.collected / summary.expected : 0;
  const canMark = can(session?.role, 'revenue.markPaid');

  function exportAll() {
    const weeks = weeksBetween(TRACKING_START, current).map((w) =>
      summarizeWeek(w, mechanics, entries, payments, now),
    );
    downloadCsv(`autorafiki-subscriptions-${current}.csv`, subscriptionsCsv(weeks));
  }

  return (
    <div className="flex flex-col gap-4">
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Saving…"
          title={moment.title}
          subtitle={moment.subtitle}
          onDone={() => setMoment(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Week">
          <Button
            variant="ghost"
            aria-label="Previous week"
            disabled={week <= TRACKING_START}
            onClick={() => setWeek(addWeeks(week, -1))}
          >
            ←
          </Button>
          <span className="min-w-44 text-center text-sm font-semibold" aria-live="polite">
            {weekLabel(week)}
            {week === current ? <span className="font-normal text-muted"> · this week</span> : null}
          </span>
          <Button
            variant="ghost"
            aria-label="Next week"
            disabled={week >= current}
            onClick={() => setWeek(addWeeks(week, 1))}
          >
            →
          </Button>
        </div>
        <Button variant="secondary" onClick={exportAll}>
          Export subscriptions CSV
        </Button>
      </div>

      <section aria-label="Week summary" className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="micro-label">Collected</span>
            <span className="text-2xl font-light">
              <AnimatedNumber value={summary.collected} format={formatUgx} />
              <span className="text-base text-muted"> of {formatUgx(summary.expected)}</span>
            </span>
          </div>
          <dl className="flex gap-6 text-sm">
            {(['paid', 'due', 'overdue'] as const).map((s) => (
              <div key={s} className="flex flex-col items-start gap-1">
                <dt>
                  <SubscriptionStatus status={s} />
                </dt>
                <dd className="text-lg">
                  <AnimatedNumber value={summary.counts[s]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div
          role="progressbar"
          aria-label="Share of this week collected"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2 overflow-hidden rounded-full bg-hairline"
        >
          <motion.div
            className="h-full bg-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={springs.settle}
          />
        </div>
        <p className="text-xs text-muted">
          {Math.round(progress * 100)}% collected · {formatUgx(WEEKLY_FEE)} per verified mechanic
          per week, due Monday, overdue from Thursday ·{' '}
          {arrears === 0
            ? 'No arrears across all weeks.'
            : `Outstanding across all weeks: ${formatUgx(arrears * WEEKLY_FEE)} (${arrears} ${arrears === 1 ? 'week' : 'weeks'}).`}
        </p>
      </section>

      {summary.rows.length === 0 ? (
        <Reveal className="panel p-6 text-sm text-muted">
          No verified mechanics owed this week.
        </Reveal>
      ) : (
        <ul key={week} className="panel" aria-label={`Subscriptions for ${weekLabel(week)}`}>
          {summary.rows.map((row, i) => (
            <Row
              key={row.mechanic.userId}
              row={row}
              weekStart={week}
              index={i}
              count={summary.rows.length}
              canMark={canMark}
              onMoment={setMoment}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

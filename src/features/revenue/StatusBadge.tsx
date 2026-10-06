import type { WeekStatus } from '@/lib/subscriptions';

const LOOK: Record<WeekStatus, { label: string; shape: string }> = {
  paid: { label: 'Paid', shape: 'bg-success' },
  due: { label: 'Due', shape: 'border border-current bg-transparent text-muted' },
  overdue: { label: 'Overdue', shape: 'sonar bg-warning text-warning' },
};

/** Text plus shape (filled / outline / pulsing); colour is only a secondary cue. */
export function SubscriptionStatus({ status }: { status: WeekStatus }) {
  const look = LOOK[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-hairline px-2 py-0.5 text-xs font-semibold">
      <span aria-hidden className={`size-2 rotate-45 ${look.shape}`} />
      {look.label}
    </span>
  );
}

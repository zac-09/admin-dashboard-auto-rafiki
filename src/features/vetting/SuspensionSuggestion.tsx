import { Button } from '@/components/ui';
import {
  overdueAccounts,
  suspensionReason,
  suspensionSuggested,
} from '@/features/revenue/collections';
import { useSubscriptionInputs } from '@/features/revenue/hooks';
import { formatUgx } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { MechanicDoc } from '@/types';

/**
 * Isaac's rule: at 2 overdue weeks, suggest (never perform) a suspension. Shown in the Decide
 * panel to roles that can see revenue and decide; "Prefill" fills the form, ops still save.
 */
export function SuspensionSuggestion({
  mechanic,
  onPrefill,
}: {
  mechanic: MechanicDoc;
  onPrefill: (reason: string) => void;
}) {
  const session = useSession();
  const allowed =
    can(session?.role, 'revenue.view') &&
    can(session?.role, 'vetting.decide') &&
    mechanic.vetting === 'verified';
  const inputs = useSubscriptionInputs(allowed);
  if (!allowed || !inputs.data) return null;
  const { mechanics, entries, payments } = inputs.data;
  const account = overdueAccounts(mechanics, entries, payments, new Date()).find(
    (a) => a.mechanic.userId === mechanic.userId,
  );
  if (!account || !suspensionSuggested(account)) return null;
  return (
    <section
      aria-label="Suspension suggested"
      className="mb-4 flex flex-col gap-2 rounded-control border border-warning p-3 text-sm"
    >
      <span className="flex items-center gap-2 font-semibold">
        <span aria-hidden className="diamond text-warning" />
        Suspension suggested
      </span>
      <span>
        {account.weeks.length} weeks of subscription unpaid ({formatUgx(account.amount)}). The
        dashboard never suspends on its own: prefill the decision, check it, then save.
      </span>
      <Button variant="secondary" onClick={() => onPrefill(suspensionReason(account))}>
        Prefill suspension
      </Button>
    </section>
  );
}

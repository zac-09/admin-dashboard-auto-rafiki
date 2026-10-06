import { useState, type FormEvent } from 'react';

import { Button, Notice } from '@/components/ui';
import {
  allowedDecisions,
  ASSESSMENT_CHECKLIST,
  decisionLabel,
  isChecklistComplete,
  MAX_REASON,
  type VettingDecision,
} from '@/lib/vetting';
import type { MechanicDoc } from '@/types';

import { decisionOutcome } from './decisionOutcome';
import { useDecideVetting } from './hooks';

function consequence(decision: VettingDecision, mechanic: MechanicDoc): string {
  if (decision === 'reject') {
    return `Stays ${mechanic.vetting}. The reason is recorded; tell the applicant by phone.`;
  }
  if (decision === 'suspend') {
    return 'Stops job broadcasts to this mechanic straight away. Jobs already in progress are not changed.';
  }
  if (mechanic.vetting === 'verified') return 'Restarts the 12-month verification clock.';
  return 'Verified mechanics receive job broadcasts whenever they are online.';
}

export interface DecisionCallbacks {
  /** The decision was sent; show the pending moment. */
  onStart: () => void;
  /** Saved: play the success moment, then show `message`. */
  onSaved: (outcome: { title: string; subtitle: string; message: string }) => void;
  /** Failed: close the moment; the form shows the error. */
  onFailed: () => void;
}

export function DecisionForm({
  mechanic,
  onStart,
  onSaved,
  onFailed,
}: {
  mechanic: MechanicDoc;
} & DecisionCallbacks) {
  const options = allowedDecisions(mechanic.vetting);
  const [decision, setDecision] = useState<VettingDecision | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const mutation = useDecideVetting();

  const needsChecklist = decision === 'approve';
  const valid =
    decision !== null &&
    reason.trim().length > 0 &&
    (!needsChecklist || isChecklistComplete(checklist));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!decision || !valid) return;
    const label = decisionLabel(decision, mechanic.vetting);
    const outcome = decisionOutcome(decision, mechanic);
    onStart();
    try {
      await mutation.mutateAsync({
        mechanicId: mechanic.userId,
        decision,
        reason: reason.trim(),
        ...(needsChecklist ? { checklist } : {}),
      });
    } catch {
      onFailed();
      return; // Shown from mutation.error below.
    }
    onSaved({ ...outcome, message: `${label}: saved and recorded in the audit log.` });
    setDecision(null);
    setChecklist([]);
    setReason('');
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Vetting decision">
      <fieldset className="flex flex-col gap-2">
        <legend className="micro-label mb-2">Decision</legend>
        {options.map((d) => (
          <label
            key={d}
            className="flex min-h-10 cursor-pointer items-start gap-3 rounded-control border border-hairline px-3 py-2 has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="decision"
              value={d}
              checked={decision === d}
              onChange={() => {
                setDecision(d);
                mutation.reset();
              }}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{decisionLabel(d, mechanic.vetting)}</span>
              <span className="text-xs text-muted">{consequence(d, mechanic)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {needsChecklist ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="micro-label mb-2">Practical assessment (all required)</legend>
          {ASSESSMENT_CHECKLIST.map((item) => (
            <label
              key={item.id}
              className="flex min-h-10 cursor-pointer items-start gap-3 py-1 text-sm"
            >
              <input
                type="checkbox"
                checked={checklist.includes(item.id)}
                onChange={(e) =>
                  setChecklist((c) =>
                    e.target.checked ? [...c, item.id] : c.filter((id) => id !== item.id),
                  )
                }
                className="mt-1"
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="decision-reason" className="micro-label">
          Reason (required, kept in the audit log)
        </label>
        <textarea
          id="decision-reason"
          required
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-control border border-hairline bg-background px-3 py-2 text-sm"
        />
        <span className="self-end text-xs text-muted">
          {reason.length}/{MAX_REASON}
        </span>
      </div>

      {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}

      <Button type="submit" disabled={!valid || mutation.isPending}>
        {mutation.isPending
          ? 'Saving…'
          : decision
            ? `${decisionLabel(decision, mechanic.vetting)} ${mechanic.businessName}`
            : 'Choose a decision'}
      </Button>
    </form>
  );
}

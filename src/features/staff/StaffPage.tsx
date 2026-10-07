import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, springs, staggerDelay, SuccessMoment, timings } from '@/components/motion';
import { Button, Notice, SkeletonTable } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { MAX_REASON } from '@/lib/vetting';
import type { AdminRole, StaffMember } from '@/types';

import { useSetRole, useStaff } from './hooks';
import { InvitePanel } from './InvitePanel';
import { RolePicker } from './RolePicker';

type Moment = { status: 'pending' | 'success'; title: string; subtitle: string } | null;

function lastSeen(m: StaffMember): string {
  if (m.disabled) return 'Disabled';
  if (!m.lastSignInAt) return 'Never signed in';
  return `Last signed in ${formatDate(m.lastSignInAt)}`;
}

function ChangeRole({
  member,
  onMoment,
  onClose,
}: {
  member: StaffMember;
  onMoment: (m: Moment) => void;
  onClose: () => void;
}) {
  const setRole = useSetRole();
  const [role, setRoleValue] = useState<AdminRole | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const unchanged = role === undefined || role === member.role;
  const missing = unchanged
    ? 'Choose a different role'
    : !reason.trim()
      ? 'Add a reason for the audit log'
      : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (missing || role === undefined) return;
    onMoment({ status: 'pending', title: '', subtitle: '' });
    try {
      await setRole.mutateAsync({ uid: member.uid, role, reason: reason.trim() });
      onMoment({
        status: 'success',
        title: role ? 'Role updated' : 'Access removed',
        subtitle: role
          ? `${member.email} is now ${ROLE_LABELS[role]}. It applies at their next sign-in (within an hour).`
          : `${member.email} can no longer use the dashboard.`,
      });
      onClose();
    } catch {
      onMoment(null);
    }
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      aria-label={`Change role for ${member.email}`}
      className="flex flex-col gap-3 rounded-control border border-hairline bg-surface p-3"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={springs.settle}
    >
      <RolePicker
        name={`role-${member.uid}`}
        value={role}
        onChange={setRoleValue}
        allowNone
        current={member.role}
      />
      <label className="flex flex-col gap-1.5">
        <span className="micro-label">Reason (kept in the audit log)</span>
        <input
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
        />
      </label>
      {setRole.error ? <Notice tone="error">{setRole.error.message}</Notice> : null}
      <div className="flex flex-wrap items-start justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          id={`save-role-${member.uid}`}
          type="submit"
          disabled={!!missing || setRole.isPending}
          hint={missing}
        >
          Save
        </Button>
      </div>
    </motion.form>
  );
}

export function StaffPage() {
  useDocumentTitle('Staff');
  const session = useSession();
  const staff = useStaff();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [moment, setMoment] = useState<Moment>(null);

  return (
    <>
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Saving…"
          title={moment.title}
          subtitle={moment.subtitle}
          onDone={() => setMoment(null)}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader label="Admin" title="Staff & roles" />
        {!inviting ? <Button onClick={() => setInviting(true)}>Invite staff</Button> : null}
      </div>

      <AnimatePresence>
        {inviting ? (
          <motion.section
            aria-label="Invite"
            className="panel mb-4 overflow-hidden p-5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: springs.settle }}
            exit={{ opacity: 0, transition: timings.exit }}
          >
            <h2 className="micro-label mb-4">Invite staff</h2>
            <InvitePanel onClose={() => setInviting(false)} />
          </motion.section>
        ) : null}
      </AnimatePresence>

      {staff.isPending ? (
        <SkeletonTable rows={4} columns={3} label="Loading staff" />
      ) : staff.error ? (
        <Notice tone="error">Could not load staff: {staff.error.message}</Notice>
      ) : (
        <ul className="panel" aria-label="Staff">
          {staff.data.map((m, i) => {
            const self = m.uid === session?.uid;
            return (
              <Reveal
                as="li"
                key={m.uid}
                delay={staggerDelay(i, staff.data.length)}
                className="flex flex-col gap-3 border-b border-hairline px-4 py-3 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="flex min-w-56 flex-1 flex-col">
                    <span className="font-semibold">
                      {m.displayName ?? m.email}
                      {self ? <span className="font-normal text-muted"> · you</span> : null}
                    </span>
                    {m.displayName ? <span className="text-xs text-muted">{m.email}</span> : null}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-control border border-hairline px-2 py-0.5 text-xs font-semibold">
                    <span
                      aria-hidden
                      className={`size-2 rotate-45 ${m.role ? 'bg-primary' : 'border border-current text-muted'}`}
                    />
                    {m.role ? ROLE_LABELS[m.role] : 'No access'}
                  </span>
                  <span className="min-w-36 text-xs text-muted">{lastSeen(m)}</span>
                  {!self && editing !== m.uid ? (
                    <Button variant="secondary" onClick={() => setEditing(m.uid)}>
                      {m.role ? 'Change role' : 'Give access'}
                    </Button>
                  ) : null}
                </div>
                {editing === m.uid ? (
                  <ChangeRole member={m} onMoment={setMoment} onClose={() => setEditing(null)} />
                ) : null}
              </Reveal>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Role changes reach someone at their next token refresh (within an hour) or when they sign in
        again. You cannot change your own role.
      </p>
    </>
  );
}

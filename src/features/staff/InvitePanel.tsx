import { useState, type FormEvent } from 'react';

import { Pop, Reveal } from '@/components/motion';
import { Button, Notice, TextField } from '@/components/ui';
import { MAX_REASON } from '@/lib/vetting';
import type { AdminRole, InviteStaffResult } from '@/types';

import { useEmailSetupLink, useInviteStaff } from './hooks';
import { RolePicker } from './RolePicker';

function SetupLink({
  email,
  result,
  onClose,
}: {
  email: string;
  result: InviteStaffResult;
  onClose: () => void;
}) {
  const send = useEmailSetupLink();
  const [copied, setCopied] = useState(0);
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.setupLink);
      setCopied((n) => n + 1);
    } catch {
      // Clipboard blocked: the link is selectable below.
    }
  }
  return (
    <Reveal className="flex flex-col gap-3" aria-label="Setup link">
      <p className="text-sm">
        <span className="font-semibold">{email}</span>{' '}
        {result.created ? 'has an account now.' : 'already had an account and now has the role.'}{' '}
        They set their password with this single-use link (it expires):
      </p>
      <code className="block overflow-x-auto rounded-control border border-hairline bg-surface px-3 py-2 text-xs select-all">
        {result.setupLink}
      </code>
      {send.error ? <Notice tone="error">{send.error.message}</Notice> : null}
      {send.isSuccess ? (
        <Notice tone="info">Firebase emailed {email} a link to set their password.</Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>
          <Pop trigger={copied}>{copied ? 'Copied' : 'Copy link'}</Pop>
        </Button>
        <Button
          variant="secondary"
          disabled={send.isPending || send.isSuccess}
          onClick={() => send.mutate(email)}
        >
          {send.isSuccess ? 'Email sent' : 'Email them a setup link'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Reveal>
  );
}

export function InvitePanel({ onClose }: { onClose: () => void }) {
  const invite = useInviteStaff();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole | null | undefined>(undefined);
  const [reason, setReason] = useState('');

  if (invite.data) {
    return <SetupLink email={email.trim().toLowerCase()} result={invite.data} onClose={onClose} />;
  }

  const missing = !email.trim()
    ? 'Enter their email'
    : !role
      ? 'Choose a role'
      : !reason.trim()
        ? 'Add a reason for the audit log'
        : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role || missing) return;
    invite.mutate({ email, displayName: name, role, reason });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Invite staff">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <RolePicker name="invite-role" value={role} onChange={setRole} />
      <label className="flex flex-col gap-1.5">
        <span className="micro-label">Reason (kept in the audit log)</span>
        <input
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. New support hire"
          className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm placeholder:text-muted"
        />
      </label>
      {invite.error ? <Notice tone="error">{invite.error.message}</Notice> : null}
      <div className="flex flex-wrap items-start justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          id="invite-submit"
          type="submit"
          disabled={!!missing || invite.isPending}
          hint={invite.isPending ? null : missing}
        >
          {invite.isPending ? 'Inviting…' : 'Invite'}
        </Button>
      </div>
    </form>
  );
}

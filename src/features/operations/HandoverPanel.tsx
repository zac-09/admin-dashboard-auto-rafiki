import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button, Notice, Skeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useSession } from '@/lib/session';
import { useLive, useNow } from '@/lib/useLive';
import { MAX_HANDOVER_NOTE, type HandoverNote } from '@/types';
import { toast } from '@/components/toast/toastStore';

const DAY_MS = 86_400_000;
const FIELD =
  'w-full rounded-control border border-hairline bg-background px-3 py-2 text-sm text-primary';

function Note({ note, canWrite }: { note: HandoverNote; canWrite: boolean }) {
  const { handover } = useRepositories();
  const handled = useMutation({
    mutationFn: () => handover.markHandled(note.id),
    onSuccess: () =>
      toast({ title: 'Marked handled', body: 'It folds away under handled notes.', tone: 'info' }),
  });
  return (
    <li className="flex gap-3 border-t border-hairline py-2.5 text-sm first:border-0">
      <span
        aria-hidden
        className={`mt-1.5 diamond ${note.handledAt ? 'text-success' : 'text-warning'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="break-words whitespace-pre-line">{note.text}</span>
        <span className="text-xs text-muted">
          {formatDateTime(note.at)} · {note.authorEmail ?? note.authorUid} (
          {ROLE_LABELS[note.authorRole]})
          {note.jobId ? (
            <>
              {' · '}
              <Link to={`/jobs/${note.jobId}`} className="underline">
                job {note.jobId}
              </Link>
            </>
          ) : null}
          {note.handledAt
            ? ` · handled ${formatDateTime(note.handledAt)} by ${note.handledByEmail ?? note.handledBy}`
            : ''}
        </span>
        {handled.error ? <Notice tone="error">{handled.error.message}</Notice> : null}
      </div>
      {!note.handledAt && canWrite ? (
        <Button
          variant="secondary"
          disabled={handled.isPending}
          loading={handled.isPending}
          onClick={() => handled.mutate()}
          aria-label={`Mark handled: ${note.text.slice(0, 40)}`}
        >
          Handled
        </Button>
      ) : null}
    </li>
  );
}

/** Notes from one shift to the next, live for everyone in the control room. */
export function HandoverPanel() {
  const { handover } = useRepositories();
  const session = useSession();
  const canWrite = can(session?.role, 'handover.write');
  const notes = useLive<HandoverNote[]>('handover', (next, fail) => handover.subscribe(next, fail));
  const [text, setText] = useState('');
  const [jobId, setJobId] = useState('');
  const add = useMutation({
    mutationFn: () => handover.add({ text: text.trim(), jobId: jobId.trim() || null }),
    onSuccess: () => {
      toast({
        title: 'Handover note added',
        body: 'The next shift sees it at the top of the panel.',
      });
      setText('');
      setJobId('');
    },
  });

  // Re-evaluated on the shared ticker, not on every render.
  const now = useNow(60_000).getTime();
  const open = notes.data?.filter((n) => !n.handledAt) ?? [];
  const recentHandled =
    notes.data?.filter((n) => n.handledAt && now - Date.parse(n.handledAt) < DAY_MS) ?? [];

  return (
    <section aria-label="Shift handover" className="panel p-4">
      <h2 className="micro-label mb-2 flex items-center justify-between">
        <span>Shift handover</span>
        {notes.status === 'ready' ? <span className="normal-case">{open.length} open</span> : null}
      </h2>
      {notes.status === 'loading' ? (
        <Skeleton className="h-10 w-full" />
      ) : notes.status === 'error' ? (
        <Notice tone="error">Could not load notes: {notes.error.message}</Notice>
      ) : open.length === 0 ? (
        <p className="flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="diamond text-success" />
          Nothing handed over.
        </p>
      ) : (
        <ul aria-label="Open handover notes">
          {open.map((n) => (
            <Note key={n.id} note={n} canWrite={canWrite} />
          ))}
        </ul>
      )}
      {recentHandled.length ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-muted">
            Handled in the last 24 hours ({recentHandled.length})
          </summary>
          <ul aria-label="Recently handled notes">
            {recentHandled.map((n) => (
              <Note key={n.id} note={n} canWrite={false} />
            ))}
          </ul>
        </details>
      ) : null}
      {canWrite ? (
        <form
          aria-label="New handover note"
          className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="flex justify-between">
              <span>Note for the next shift</span>
              <span>
                {text.length}/{MAX_HANDOVER_NOTE}
              </span>
            </span>
            <textarea
              rows={2}
              value={text}
              maxLength={MAX_HANDOVER_NOTE}
              onChange={(e) => setText(e.target.value)}
              placeholder="Watching the Ntinda battery job; called Okello about lateness."
              className={FIELD}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Job id (optional)
              <input
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className={`${FIELD} min-h-10 w-56`}
              />
            </label>
            <Button
              type="submit"
              disabled={!text.trim() || add.isPending}
              loading={add.isPending}
              hint={text.trim() ? null : 'Write the note first'}
            >
              {add.isPending ? 'Saving…' : 'Add note'}
            </Button>
          </div>
          {add.error ? <Notice tone="error">{add.error.message}</Notice> : null}
        </form>
      ) : null}
    </section>
  );
}

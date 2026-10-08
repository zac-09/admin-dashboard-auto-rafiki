import { useState, type FormEvent } from 'react';

import { Reveal } from '@/components/motion';
import { Button, Notice, SkeletonLines } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { MAX_NOTE, type SupportNote } from '@/types';

import { useAddNote, useNotes } from './hooks';

const KIND: Record<SupportNote['kind'], string> = {
  note: 'Note',
  'dispute-opened': 'Dispute opened',
  'dispute-resolved': 'Dispute resolved',
  intervention: 'Ops action',
};

/** Internal notes on a job (never visible to app users), newest last like a log. */
export function NotesPanel({ jobId }: { jobId: string }) {
  const session = useSession();
  const live = useNotes(jobId);
  const add = useAddNote(jobId);
  const [text, setText] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await add.mutateAsync(text.trim());
      setText('');
    } catch {
      // Shown from add.error.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {live.status === 'loading' ? (
        <SkeletonLines lines={2} />
      ) : live.status === 'error' ? (
        <Notice tone="error">Could not load notes: {live.error.message}</Notice>
      ) : live.data.length === 0 ? (
        <p className="text-sm text-muted">No notes yet. Only staff can see notes.</p>
      ) : (
        <ol className="flex flex-col gap-3 text-sm" aria-label="Support notes">
          {live.data.map((n) => (
            <Reveal as="li" key={n.id} className="flex gap-3">
              <span
                aria-hidden
                className={`mt-1.5 diamond ${
                  n.kind === 'note'
                    ? 'text-muted'
                    : n.kind === 'intervention'
                      ? 'text-accent'
                      : 'text-warning'
                }`}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">
                  <span className="font-semibold text-primary">{KIND[n.kind]}</span> ·{' '}
                  {n.authorEmail ?? n.authorUid} · {formatDateTime(n.createdAt)}
                </span>
                <span className="whitespace-pre-line">{n.text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      )}

      {can(session?.role, 'support.annotate') ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-label="Add a note">
          <label htmlFor={`note-${jobId}`} className="sr-only">
            New note
          </label>
          <textarea
            id={`note-${jobId}`}
            rows={2}
            maxLength={MAX_NOTE}
            placeholder="Add an internal note (who you called, what they said)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-control border border-hairline bg-background px-3 py-2 text-sm placeholder:text-muted"
          />
          {add.error ? <Notice tone="error">{add.error.message}</Notice> : null}
          <Button
            type="submit"
            variant="secondary"
            className="self-end"
            disabled={!text.trim() || add.isPending}
          >
            {add.isPending ? 'Saving…' : 'Add note'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

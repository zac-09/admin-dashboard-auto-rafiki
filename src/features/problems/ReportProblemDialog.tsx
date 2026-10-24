import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';

import { springs, timings } from '@/components/motion';
import { toast } from '@/components/toast/toastStore';
import { Button, Notice } from '@/components/ui';
import { useUnsaved } from '@/components/unsaved/unsavedStore';
import { ROLE_LABELS } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { MAX_PROBLEM_REPORT } from '@/types';

import { currentContext, useReportProblem } from './hooks';
import { useReportDialog } from './reportStore';

function Form({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const [description, setDescription] = useState('');
  const send = useReportProblem();
  const field = useRef<HTMLTextAreaElement>(null);
  // Taken when the dialog opens: the page the problem was on, not wherever they go next.
  const { pathname, search } = useLocation();
  const [context] = useState(() => currentContext(pathname + search));
  useUnsaved(description.trim() !== '' && !send.isSuccess);

  useEffect(() => {
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) return;
    try {
      await send.mutateAsync({ description: description.trim(), context });
      toast({ title: 'Thanks, problem reported', body: 'An admin will look at it.' });
      onClose();
    } catch {
      // Shown from send.error.
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="Report a problem" className="flex flex-col gap-3">
      <h2 id="report-title" className="text-base font-semibold">
        Report a problem
      </h2>
      <label className="flex flex-col gap-1.5 text-sm">
        <span>What went wrong, and what did you expect?</span>
        <textarea
          ref={field}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_PROBLEM_REPORT}
          rows={5}
          className="rounded-control border border-hairline bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          placeholder="I clicked Mark paid for Okello and nothing happened…"
        />
      </label>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Sent with it automatically</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>Page</dt>
          <dd className="truncate">{context.path}</dd>
          <dt>You</dt>
          <dd className="truncate">
            {session?.email} ({session?.role ? ROLE_LABELS[session.role] : 'no role'})
          </dd>
          <dt>Screen</dt>
          <dd>
            {context.viewport}, {context.theme} mode
          </dd>
          <dt>Browser</dt>
          <dd className="truncate">{context.userAgent}</dd>
        </dl>
      </details>
      {send.error ? <Notice tone="error">{send.error.message}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!description.trim()}
          loading={send.isPending}
          hint={description.trim() ? null : 'Describe the problem first'}
        >
          {send.isPending ? 'Sending…' : 'Send report'}
        </Button>
      </div>
    </form>
  );
}

/** Mounted once by the shell. */
export function ReportProblemDialog() {
  const { open, setOpen } = useReportDialog();
  const close = () => setOpen(false);
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-primary/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: timings.fade }}
            exit={{ opacity: 0, transition: timings.exit }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="relative w-full max-w-lg rounded-panel border border-hairline bg-background p-5 shadow-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springs.settle }}
            exit={{ opacity: 0, transition: timings.exit }}
          >
            <Form onClose={close} />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

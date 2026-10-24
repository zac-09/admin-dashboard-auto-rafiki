import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { springs, timings } from '../motion/presets';

import { useToasts, type Toast } from './toastStore';

/** How long a toast stays, unless the pointer or focus is on it. */
export const TOAST_MS = 6000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [held, dismiss, toast.id]);

  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: springs.settle }}
      exit={{ opacity: 0, transition: timings.exit }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-panel border border-hairline bg-background p-3 text-sm shadow-lg"
    >
      <span
        aria-hidden
        className={`mt-1.5 diamond shrink-0 ${toast.tone === 'success' ? 'text-success' : 'text-accent'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{toast.title}</span>
        {toast.body ? <span className="text-muted">{toast.body}</span> : null}
        {toast.link ? (
          <Link
            to={toast.link.to}
            onClick={() => dismiss(toast.id)}
            className="mt-1 self-start text-xs font-semibold underline"
          >
            {toast.link.label}
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={`Dismiss: ${toast.title}`}
        className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:text-primary"
      >
        <span aria-hidden>×</span>
      </button>
    </motion.li>
  );
}

/**
 * Confirmations after an action, bottom right (bottom, full width on phones). A polite live
 * region: screen readers hear each one without losing their place.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:w-96 print:hidden"
    >
      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

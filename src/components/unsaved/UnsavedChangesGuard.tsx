import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

import { springs, timings } from '../motion/presets';
import { Button } from '../ui/Button';

import { useUnsavedStore } from './unsavedStore';

/**
 * One guard for the whole dashboard (a router allows a single blocker): while any form holds
 * unsaved text, leaving the page asks first, and closing or reloading the tab gets the
 * browser's own warning.
 */
export function UnsavedChangesGuard() {
  const dirty = useUnsavedStore((s) => s.dirty.size > 0);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const stay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers need a returnValue to show the prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const open = blocker.state === 'blocked';
  useEffect(() => {
    if (!open) return;
    stay.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && blocker.reset?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, blocker]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-primary/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: timings.fade }}
            exit={{ opacity: 0, transition: timings.exit }}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
            aria-describedby="unsaved-body"
            className="relative flex w-full max-w-sm flex-col gap-3 rounded-panel border border-hairline bg-background p-5 shadow-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springs.settle }}
            exit={{ opacity: 0, transition: timings.exit }}
          >
            <h2 id="unsaved-title" className="text-base font-semibold">
              Leave without saving?
            </h2>
            <p id="unsaved-body" className="text-sm text-muted">
              What you typed on this page has not been saved. If you leave now it will be lost.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="danger" onClick={() => blocker.proceed?.()}>
                Leave and discard
              </Button>
              <Button ref={stay} onClick={() => blocker.reset?.()}>
                Stay on this page
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

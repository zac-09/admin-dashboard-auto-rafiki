import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { springs, timings } from '@/components/motion';
import { Button } from '@/components/ui';
import { usePalette } from '@/features/support/paletteStore';
import { can } from '@/lib/permissions';
import type { AdminSession } from '@/types';

import { NAV_ITEMS } from '../navigation';

import { isTyping, SEQUENCE_MS, shortcutFor } from './shortcutKeys';
import { useShortcutsSheet } from './shortcutsStore';

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-control border border-hairline bg-surface px-1.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

function Sheet({ session, onClose }: { session: AdminSession; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const items = NAV_ITEMS.filter((i) => can(session.role, i.permission));
  const row = 'flex min-h-8 items-center justify-between gap-4 text-sm';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-primary/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: timings.fade }}
        exit={{ opacity: 0, transition: timings.exit }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-panel border border-hairline bg-background p-5 shadow-xl"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: springs.settle }}
        exit={{ opacity: 0, transition: timings.exit }}
      >
        <h2 id="shortcuts-title" className="text-base font-semibold">
          Keyboard shortcuts
        </h2>
        <section aria-label="Anywhere" className="flex flex-col gap-1">
          <h3 className="micro-label mb-1">Anywhere</h3>
          {can(session.role, 'support.view') ? (
            <div className={row}>
              <span>Search people, jobs and plates</span>
              <span className="flex gap-1">
                <Key>⌘K</Key> <span className="text-muted">or</span> <Key>/</Key>
              </span>
            </div>
          ) : null}
          <div className={row}>
            <span>This list</span>
            <Key>?</Key>
          </div>
          <div className={row}>
            <span>Close a dialog or menu</span>
            <Key>Esc</Key>
          </div>
        </section>
        <section aria-label="Go to" className="flex flex-col gap-1">
          <h3 className="micro-label mb-1">Go to (press g, then the letter)</h3>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {items.map((i) => (
              <div key={i.to} className={row}>
                <span>{i.label}</span>
                <span className="flex gap-1">
                  <Key>g</Key>
                  <Key>{i.key}</Key>
                </span>
              </div>
            ))}
          </div>
        </section>
        <p className="text-xs text-muted">Shortcuts pause while you are typing in a field.</p>
        <div className="flex justify-end">
          <Button ref={close} variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/** Listens for shortcuts on every page and shows the ? sheet. Mounted once by the shell. */
export function Shortcuts({ session }: { session: AdminSession }) {
  const navigate = useNavigate();
  const { open, setOpen } = useShortcutsSheet();
  const gAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      // Another dialog is open: it owns the keyboard.
      if (document.querySelector('[aria-modal="true"]')) return;
      const afterG = Date.now() - gAt.current < SEQUENCE_MS;
      const action = shortcutFor(e.key, afterG, session.role);
      gAt.current = action?.kind === 'pending' ? Date.now() : 0;
      if (!action || action.kind === 'pending') return;
      e.preventDefault();
      if (action.kind === 'go') navigate(action.to);
      else if (action.kind === 'search') usePalette.getState().setOpen(true);
      else setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, session.role, setOpen]);

  return (
    <AnimatePresence>
      {open ? <Sheet session={session} onClose={() => setOpen(false)} /> : null}
    </AnimatePresence>
  );
}

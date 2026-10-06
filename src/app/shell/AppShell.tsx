import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Reveal, springs, timings } from '@/components/motion';
import { WheelMark } from '@/components/ui';
import type { AdminSession } from '@/types';

import { Sidebar } from './Sidebar';

/** Sidebar on desktop; a top bar with a sliding drawer on phones (triage from a phone). */
export function AppShell({ session }: { session: AdminSession }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // Escape closes; focus moves into the drawer and back to the button; the page stays put.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('a, button')?.focus();
    const button = menuButton.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      button?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* The column carries the background for the full page height; the content sticks. */}
      <aside className="hidden border-r border-hairline bg-surface md:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar session={session} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-background px-4 py-2 md:hidden">
        <div className="flex items-center gap-2">
          <WheelMark size={32} />
          <span className="text-sm font-semibold tracking-[0.2em]">AUTORAFIKI</span>
        </div>
        <button
          ref={menuButton}
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="nav-drawer"
          onClick={() => setDrawerOpen((o) => !o)}
          className="min-h-10 rounded-control border border-hairline px-3 text-sm"
        >
          Menu
        </button>
      </header>

      <AnimatePresence>
        {drawerOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-primary/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: timings.fade }}
              exit={{ opacity: 0, transition: timings.exit }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              ref={drawer}
              id="nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-hairline bg-surface shadow-xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: springs.settle }}
              exit={{ x: '-100%', transition: timings.exit }}
            >
              <Sidebar session={session} onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 p-4 md:p-8">
        {/* Each page settles in like the app's screens; tabs within a page do not re-trigger. */}
        <Reveal key={pathname} from="down">
          <Outlet />
        </Reveal>
      </main>
    </div>
  );
}

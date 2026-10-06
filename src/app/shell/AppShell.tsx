import { useState } from 'react';
import { Outlet } from 'react-router';

import { WheelMark } from '@/components/ui';
import type { AdminSession } from '@/types';

import { Sidebar } from './Sidebar';

/** Sidebar on desktop; a top bar with a drawer on phones (triage from a phone). */
export function AppShell({ session }: { session: AdminSession }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-hairline md:block">
        <Sidebar session={session} />
      </aside>

      <header className="flex items-center justify-between border-b border-hairline px-4 py-2 md:hidden">
        <div className="flex items-center gap-2">
          <WheelMark size={32} />
          <span className="text-sm font-semibold tracking-[0.2em]">AUTORAFIKI</span>
        </div>
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="nav-drawer"
          onClick={() => setDrawerOpen((o) => !o)}
          className="min-h-10 rounded-control border border-hairline px-3 text-sm"
        >
          {drawerOpen ? 'Close' : 'Menu'}
        </button>
      </header>
      {drawerOpen ? (
        <div id="nav-drawer" className="border-b border-hairline md:hidden">
          <Sidebar session={session} onNavigate={() => setDrawerOpen(false)} />
        </div>
      ) : null}

      <main className="min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

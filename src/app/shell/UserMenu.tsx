import { useState } from 'react';

import { ROLE_LABELS } from '@/lib/permissions';
import { getRepositories } from '@/lib/repositories';
import { useThemeMode } from '@/theme/themeMode';
import type { AdminSession } from '@/types';

export function UserMenu({ session }: { session: AdminSession }) {
  const [open, setOpen] = useState(false);
  const { mode, toggle } = useThemeMode();
  return (
    <div className="border-t border-hairline p-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full flex-col items-start rounded-control px-2 py-1.5 text-left hover:bg-background"
      >
        <span className="truncate text-sm font-semibold">
          {session.displayName ?? session.email}
        </span>
        <span className="truncate text-xs text-muted">
          {session.role ? ROLE_LABELS[session.role] : 'No role'} · {session.email}
        </span>
      </button>
      {open ? (
        <div id="user-menu" className="mt-2 flex flex-col gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={mode === 'dark'}
            onClick={toggle}
            className="flex min-h-10 items-center justify-between rounded-control px-2 text-sm hover:bg-background"
          >
            <span>Dark mode</span>
            <span className="micro-label">{mode === 'dark' ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            onClick={() => getRepositories().auth.signOut()}
            className="flex min-h-10 items-center rounded-control px-2 text-sm hover:bg-background"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

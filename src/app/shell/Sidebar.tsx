import { motion } from 'motion/react';
import { useId } from 'react';
import { NavLink } from 'react-router';

import { springs } from '@/components/motion';
import { WheelMark } from '@/components/ui';
import { usePalette } from '@/features/support/paletteStore';
import { can } from '@/lib/permissions';
import type { AdminSession } from '@/types';

import { NAV_ITEMS } from '../navigation';

import { UserMenu } from './UserMenu';

export function Sidebar({
  session,
  onNavigate,
}: {
  session: AdminSession;
  onNavigate?: () => void;
}) {
  const items = NAV_ITEMS.filter((item) => can(session.role, item.permission));
  // Separate ids for the desktop sidebar and the phone drawer so their highlights never jump between them.
  const highlight = useId();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <WheelMark size={40} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-[0.2em]">AUTORAFIKI</span>
          <span className="micro-label">Operations</span>
        </div>
      </div>
      {can(session.role, 'support.view') ? (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              usePalette.getState().setOpen(true);
            }}
            className="flex min-h-10 w-full items-center justify-between rounded-control border border-hairline bg-background px-3 text-sm text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <span>Search</span>
            <kbd className="text-xs">⌘K</kbd>
          </button>
        </div>
      ) : null}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex min-h-10 items-center gap-3 rounded-control px-3 text-sm transition-colors ${
                    isActive ? 'font-semibold text-primary' : 'text-muted hover:text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* The highlight slides from item to item; active also = diamond + weight. */}
                    {isActive ? (
                      <motion.span
                        layoutId={`nav-active-${highlight}`}
                        aria-hidden
                        className="absolute inset-0 rounded-control bg-background before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-accent"
                        transition={springs.snappy}
                      />
                    ) : null}
                    <motion.span
                      aria-hidden
                      className="diamond relative"
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.4 }}
                      transition={springs.pop}
                    />
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <UserMenu session={session} />
    </div>
  );
}

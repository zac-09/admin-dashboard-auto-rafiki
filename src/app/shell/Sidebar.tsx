import { NavLink } from 'react-router';

import { WheelMark } from '@/components/ui';
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
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-3 px-4 py-5">
        <WheelMark size={40} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-[0.2em]">AUTORAFIKI</span>
          <span className="micro-label">Operations</span>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 px-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex min-h-10 items-center gap-3 rounded-control px-3 text-sm ${
                    isActive
                      ? 'bg-background font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-accent'
                      : 'text-muted hover:bg-background hover:text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active state = diamond + weight + accent bar, never colour alone. */}
                    <span aria-hidden className={`diamond ${isActive ? '' : 'opacity-0'}`} />
                    {item.label}
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

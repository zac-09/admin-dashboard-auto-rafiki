import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { can, type Permission } from '@/lib/permissions';
import { useSession, useSessionStore } from '@/lib/session';

import { NoAccessPage } from './pages/NoAccessPage';
import { NotPermittedPage } from './pages/NotPermittedPage';
import { AppShell } from './shell/AppShell';

/** Signed-in staff get the shell; others go to /login or the no-access page. */
export function ProtectedShell() {
  const { status, session } = useSessionStore();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <p role="status" className="p-8 text-sm text-muted">
        Loading…
      </p>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!session.role) return <NoAccessPage session={session} />;
  return <AppShell session={session} />;
}

/** UX gate only. Rules and Cloud Functions enforce the same permissions server-side. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const session = useSession();
  return can(session?.role, permission) ? children : <NotPermittedPage />;
}

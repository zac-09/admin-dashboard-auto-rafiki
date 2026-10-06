import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { JobDetailPage } from '@/features/operations/JobDetailPage';
import { OperationsPage } from '@/features/operations/OperationsPage';
import { PersonPage } from '@/features/support/PersonPage';
import { SupportPage } from '@/features/support/SupportPage';
import { MechanicDetailPage } from '@/features/vetting/MechanicDetailPage';
import { VettingQueuePage } from '@/features/vetting/VettingQueuePage';

import { RequirePermission, ProtectedShell } from './guards';
import { NAV_ITEMS } from './navigation';
import { LegacyJobRedirect } from './pages/LegacyJobRedirect';
import { LoginPage } from './pages/LoginPage';
import { ModulePlaceholder } from './pages/ModulePlaceholder';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedShell />,
    children: [
      // Every role can view vetting, the first module.
      { index: true, element: <Navigate to="/vetting" replace /> },
      {
        path: '/vetting',
        element: (
          <RequirePermission permission="vetting.view">
            <VettingQueuePage />
          </RequirePermission>
        ),
      },
      {
        path: '/vetting/:mechanicId',
        element: (
          <RequirePermission permission="vetting.view">
            <MechanicDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: '/operations',
        element: (
          <RequirePermission permission="operations.view">
            <OperationsPage />
          </RequirePermission>
        ),
      },
      { path: '/operations/jobs/:jobId', element: <LegacyJobRedirect /> },
      {
        // One job page for operations and support alike.
        path: '/jobs/:jobId',
        element: (
          <RequirePermission permission="support.view">
            <JobDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: '/support',
        element: (
          <RequirePermission permission="support.view">
            <SupportPage />
          </RequirePermission>
        ),
      },
      {
        path: '/support/people/:userId',
        element: (
          <RequirePermission permission="support.view">
            <PersonPage />
          </RequirePermission>
        ),
      },
      // Modules not built yet.
      ...NAV_ITEMS.filter((item) => !['/vetting', '/operations', '/support'].includes(item.to)).map(
        (item) => ({
          path: item.to,
          element: (
            <RequirePermission permission={item.permission}>
              <ModulePlaceholder item={item} />
            </RequirePermission>
          ),
        }),
      ),
      { path: '*', element: <Navigate to="/vetting" replace /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}

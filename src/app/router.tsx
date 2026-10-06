import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { MechanicDetailPage } from '@/features/vetting/MechanicDetailPage';
import { VettingQueuePage } from '@/features/vetting/VettingQueuePage';

import { RequirePermission, ProtectedShell } from './guards';
import { NAV_ITEMS } from './navigation';
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
      // Modules not built yet.
      ...NAV_ITEMS.filter((item) => item.to !== '/vetting').map((item) => ({
        path: item.to,
        element: (
          <RequirePermission permission={item.permission}>
            <ModulePlaceholder item={item} />
          </RequirePermission>
        ),
      })),
      { path: '*', element: <Navigate to="/vetting" replace /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}

import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

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
      ...NAV_ITEMS.map((item) => ({
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

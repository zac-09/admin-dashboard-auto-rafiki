import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import {
  AuditLogPage,
  CustomersPage,
  InsightsPage,
  MessagesPage,
  WeeklyReportPage,
  JobDetailPage,
  MechanicDetailPage,
  OperationsPage,
  PersonPage,
  RevenuePage,
  SettingsPage,
  StaffPage,
  SupportPage,
  VettingQueuePage,
} from './pages';

import { RequirePermission, ProtectedShell } from './guards';
import { LegacyJobRedirect } from './pages/LegacyJobRedirect';
import { LoginPage } from './pages/LoginPage';

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
        path: '/customers',
        element: (
          <RequirePermission permission="support.view">
            <CustomersPage />
          </RequirePermission>
        ),
      },
      {
        path: '/revenue',
        element: (
          <RequirePermission permission="revenue.view">
            <RevenuePage />
          </RequirePermission>
        ),
      },
      {
        path: '/insights',
        element: (
          <RequirePermission permission="insights.view">
            <InsightsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/messages',
        element: (
          <RequirePermission permission="mechanics.message">
            <MessagesPage />
          </RequirePermission>
        ),
      },
      {
        path: '/report',
        element: (
          <RequirePermission permission="insights.view">
            <WeeklyReportPage />
          </RequirePermission>
        ),
      },
      {
        path: '/settings',
        element: (
          <RequirePermission permission="settings.view">
            <SettingsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/staff',
        element: (
          <RequirePermission permission="staff.manage">
            <StaffPage />
          </RequirePermission>
        ),
      },
      {
        path: '/audit',
        element: (
          <RequirePermission permission="audit.view">
            <AuditLogPage />
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
      { path: '*', element: <Navigate to="/vetting" replace /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}

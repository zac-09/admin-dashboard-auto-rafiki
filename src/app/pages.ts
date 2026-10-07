import { lazy } from 'react';

/**
 * Module pages, each in its own chunk: signing in downloads the shell, and a page's code only
 * when someone opens it. The router wraps them in Suspense with a skeleton.
 */
export const VettingQueuePage = lazy(() =>
  import('@/features/vetting/VettingQueuePage').then((m) => ({ default: m.VettingQueuePage })),
);
export const MechanicDetailPage = lazy(() =>
  import('@/features/vetting/MechanicDetailPage').then((m) => ({ default: m.MechanicDetailPage })),
);
export const OperationsPage = lazy(() =>
  import('@/features/operations/OperationsPage').then((m) => ({ default: m.OperationsPage })),
);
export const JobDetailPage = lazy(() =>
  import('@/features/operations/JobDetailPage').then((m) => ({ default: m.JobDetailPage })),
);
export const SupportPage = lazy(() =>
  import('@/features/support/SupportPage').then((m) => ({ default: m.SupportPage })),
);
export const PersonPage = lazy(() =>
  import('@/features/support/PersonPage').then((m) => ({ default: m.PersonPage })),
);
export const RevenuePage = lazy(() =>
  import('@/features/revenue/RevenuePage').then((m) => ({ default: m.RevenuePage })),
);
export const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
export const StaffPage = lazy(() =>
  import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })),
);

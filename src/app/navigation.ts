import type { Permission } from '@/lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  /** Build order from CLAUDE.md, shown on placeholder pages. */
  module: number;
  summary: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/vetting',
    label: 'Vetting',
    permission: 'vetting.view',
    module: 1,
    summary:
      'Pending, verified and suspended mechanics; approve, reject and suspend with a reason.',
  },
  {
    to: '/operations',
    label: 'Operations',
    permission: 'operations.view',
    module: 2,
    summary: 'Live job board, ops map and alert rail.',
  },
  {
    to: '/support',
    label: 'Support',
    permission: 'support.view',
    module: 3,
    summary: 'Search by phone, job id or business name; job timelines, notes and disputes.',
  },
  {
    to: '/revenue',
    label: 'Revenue',
    permission: 'revenue.view',
    module: 4,
    summary: 'Phase-1 subscription tracker, KPIs and CSV export.',
  },
  {
    to: '/settings',
    label: 'Settings',
    permission: 'settings.view',
    module: 5,
    summary: 'Upfront prices, broadcast radius and timeout.',
  },
  {
    to: '/staff',
    label: 'Staff',
    permission: 'staff.manage',
    module: 5,
    summary: 'Dashboard accounts and roles.',
  },
];

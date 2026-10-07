import type { Permission } from '@/lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/vetting',
    label: 'Vetting',
    permission: 'vetting.view',
  },
  {
    to: '/operations',
    label: 'Operations',
    permission: 'operations.view',
  },
  {
    to: '/support',
    label: 'Support',
    permission: 'support.view',
  },
  {
    to: '/revenue',
    label: 'Revenue',
    permission: 'revenue.view',
  },
  {
    to: '/settings',
    label: 'Settings',
    permission: 'settings.view',
  },
  {
    to: '/staff',
    label: 'Staff',
    permission: 'staff.manage',
  },
];

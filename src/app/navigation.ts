import type { Permission } from '@/lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/today',
    label: 'Today',
    permission: 'today.view',
  },
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
    to: '/messages',
    label: 'Messages',
    permission: 'mechanics.message',
  },
  {
    to: '/support',
    label: 'Support',
    permission: 'support.view',
  },
  {
    to: '/customers',
    label: 'Customers',
    permission: 'support.view',
  },
  {
    to: '/revenue',
    label: 'Revenue',
    permission: 'revenue.view',
  },
  {
    to: '/insights',
    label: 'Insights',
    permission: 'insights.view',
  },
  {
    to: '/settings',
    label: 'Settings',
    permission: 'settings.view',
  },
  {
    to: '/audit',
    label: 'Audit log',
    permission: 'audit.view',
  },
  {
    to: '/staff',
    label: 'Staff',
    permission: 'staff.manage',
  },
];

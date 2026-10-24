import type { Permission } from '@/lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  /** "g" then this key goes here (see the ? shortcuts sheet). */
  key: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/today',
    label: 'Today',
    permission: 'today.view',
    key: 't',
  },
  {
    to: '/vetting',
    label: 'Vetting',
    permission: 'vetting.view',
    key: 'v',
  },
  {
    to: '/operations',
    label: 'Operations',
    permission: 'operations.view',
    key: 'o',
  },
  {
    to: '/messages',
    label: 'Messages',
    permission: 'mechanics.message',
    key: 'm',
  },
  {
    to: '/support',
    label: 'Support',
    permission: 'support.view',
    key: 's',
  },
  {
    to: '/customers',
    label: 'Customers',
    permission: 'support.view',
    key: 'c',
  },
  {
    to: '/revenue',
    label: 'Revenue',
    permission: 'revenue.view',
    key: 'r',
  },
  {
    to: '/insights',
    label: 'Insights',
    permission: 'insights.view',
    key: 'i',
  },
  {
    to: '/settings',
    label: 'Settings',
    permission: 'settings.view',
    key: 'e',
  },
  {
    to: '/audit',
    label: 'Audit log',
    permission: 'audit.view',
    key: 'a',
  },
  {
    to: '/staff',
    label: 'Staff',
    permission: 'staff.manage',
    key: 'f',
  },
  {
    to: '/problems',
    label: 'Problem reports',
    permission: 'problems.manage',
    key: 'p',
  },
];

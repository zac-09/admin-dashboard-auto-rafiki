import type { AdminRole, AdminSession } from '@/types';

/** Mock staff accounts. Password for all of them: MOCK_PASSWORD. */
export const MOCK_PASSWORD = 'autorafiki';

export const MOCK_STAFF: readonly (AdminSession & { role: AdminRole })[] = [
  { uid: 'staff-admin', email: 'admin@autorafiki.test', displayName: 'Amina Admin', role: 'admin' },
  { uid: 'staff-ops', email: 'ops@autorafiki.test', displayName: 'Okello Ops', role: 'ops' },
  {
    uid: 'staff-support',
    email: 'support@autorafiki.test',
    displayName: 'Sarah Support',
    role: 'support',
  },
];

/** An app user (phone sign-in, no role claim): signs in but gets no dashboard access. */
export const MOCK_APP_USER: AdminSession = {
  uid: 'app-user',
  email: 'customer@autorafiki.test',
  displayName: 'Nakato Customer',
  role: null,
};

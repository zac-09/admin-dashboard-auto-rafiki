import type { AuditEntry } from '@/types';

import { FIXTURE_NOW } from './contractFixtures';

const daysAgo = (d: number) => new Date(FIXTURE_NOW.getTime() - d * 86_400_000).toISOString();
const ALL_ITEMS = ['identity', 'skills', 'tools', 'phone', 'conduct'];

/**
 * Vetting history for the contract fixtures. Okello Auto Rescue deliberately has none: he was
 * verified by the app's seed script before the dashboard existed, so he shows up as due for
 * re-verification ("no verification on record").
 */
export const AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: 'audit_kato_reject',
    action: 'mechanic.vetting.reject',
    actorUid: 'staff-ops',
    actorEmail: 'ops@autorafiki.test',
    actorRole: 'ops',
    targetType: 'mechanic',
    targetId: 'u_mech_kato',
    targetLabel: 'Kato Battery & Tyre',
    before: 'pending',
    after: 'pending',
    reason: 'Could not show a working battery tester. Asked to come back with one.',
    at: daysAgo(0.5),
  },
  {
    id: 'audit_waiswa_suspend',
    action: 'mechanic.vetting.suspend',
    actorUid: 'staff-admin',
    actorEmail: 'admin@autorafiki.test',
    actorRole: 'admin',
    targetType: 'mechanic',
    targetId: 'u_mech_waiswa',
    targetLabel: 'Waiswa Heavy Recovery',
    before: 'verified',
    after: 'suspended',
    reason: 'Three 1-star ratings in a week; customer reported overcharging.',
    at: daysAgo(6),
  },
  {
    id: 'audit_namukasa_approve',
    action: 'mechanic.vetting.approve',
    actorUid: 'staff-admin',
    actorEmail: 'admin@autorafiki.test',
    actorRole: 'admin',
    targetType: 'mechanic',
    targetId: 'u_mech_namukasa',
    targetLabel: 'Namukasa Motors',
    before: 'pending',
    after: 'verified',
    reason: 'Passed the practical at the Nakawa yard.',
    checklist: ALL_ITEMS,
    at: daysAgo(38),
  },
  {
    id: 'audit_waiswa_approve',
    action: 'mechanic.vetting.approve',
    actorUid: 'staff-admin',
    actorEmail: 'admin@autorafiki.test',
    actorRole: 'admin',
    targetType: 'mechanic',
    targetId: 'u_mech_waiswa',
    targetLabel: 'Waiswa Heavy Recovery',
    before: 'pending',
    after: 'verified',
    reason: 'Towing rig inspected.',
    checklist: ALL_ITEMS,
    at: daysAgo(118),
  },
];

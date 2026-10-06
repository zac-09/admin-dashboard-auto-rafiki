import type { Job, JobStatus, MechanicDoc, UserDoc } from '../../src/types';

/** A small, fixed cast for rules tests. */
export const UID = {
  customer: 'u_customer',
  otherCustomer: 'u_other_customer',
  mechanic: 'u_mechanic', // verified
  otherMechanic: 'u_other_mechanic', // verified
  pendingMechanic: 'u_pending_mechanic',
  suspendedMechanic: 'u_suspended_mechanic',
} as const;

export const PHONE = {
  customer: '+256772000001',
  otherCustomer: '+256772000002',
  mechanic: '+256701000001',
  otherMechanic: '+256701000002',
  pendingMechanic: '+256701000003',
  suspendedMechanic: '+256701000004',
} as const;

export const KOLOLO = { latitude: 0.3339, longitude: 32.5931, label: 'Kololo, Acacia Avenue' };

export function userDoc(id: string, phone: UserDoc['phone'], roles: UserDoc['roles']): UserDoc {
  return {
    id,
    phone,
    displayName: id,
    roles,
    activeRole: roles[0]!,
    createdAt: '2026-09-01T08:00:00.000Z',
  };
}

export function mechanicDoc(userId: string, vetting: MechanicDoc['vetting']): MechanicDoc {
  return {
    userId,
    businessName: `${userId} Motors`,
    services: ['flat-tyre', 'battery'],
    vehicles: ['car'],
    ratingAverage: 0,
    ratingCount: 0,
    jobsCompleted: 0,
    vetting,
    isOnline: true,
    lastKnownLocation: KOLOLO,
    calloutFee: 30_000,
  };
}

const STEPS: JobStatus[] = ['requested', 'matched', 'enroute', 'arrived', 'working', 'complete'];

/** A job document as the app leaves it at `status` (timeline walked step by step). */
export function jobDoc(
  id: string,
  status: JobStatus,
  opts: { customerId?: string; mechanicId?: string } = {},
): Job {
  const createdAt = '2026-10-01T10:00:00.000Z';
  const walk =
    status === 'cancelled' ? ['requested' as const] : STEPS.slice(0, STEPS.indexOf(status) + 1);
  const timeline = walk.map((s, i) => ({
    status: s,
    at: new Date(Date.parse(createdAt) + i * 60_000).toISOString(),
  }));
  if (status === 'cancelled')
    timeline.push({ status: 'cancelled', at: '2026-10-01T10:05:00.000Z' });
  const job: Job = {
    id,
    request: {
      id,
      customerId: opts.customerId ?? UID.customer,
      location: KOLOLO,
      vehicle: 'car',
      service: 'battery',
      description: 'Will not start',
      createdAt,
    },
    status,
    radiusKm: 5,
    expiresAt: '2026-10-01T10:01:30.000Z',
    fee: 35_000,
    timeline,
  };
  const matched = status !== 'requested' && status !== 'cancelled';
  if (matched || opts.mechanicId) job.mechanicId = opts.mechanicId ?? UID.mechanic;
  if (status === 'cancelled') job.cancelledBy = 'customer';
  return job;
}

/** users, profiles and mechanics for the whole cast. */
export function baseWorld(): Record<string, object> {
  const docs: Record<string, object> = {
    [`users/${UID.customer}`]: userDoc(UID.customer, PHONE.customer, ['customer']),
    [`users/${UID.otherCustomer}`]: userDoc(UID.otherCustomer, PHONE.otherCustomer, ['customer']),
  };
  for (const [key, vetting] of [
    ['mechanic', 'verified'],
    ['otherMechanic', 'verified'],
    ['pendingMechanic', 'pending'],
    ['suspendedMechanic', 'suspended'],
  ] as const) {
    const uid = UID[key];
    docs[`users/${uid}`] = userDoc(uid, PHONE[key], ['customer', 'mechanic']);
    docs[`mechanics/${uid}`] = { ...mechanicDoc(uid, vetting), phone: PHONE[key] };
  }
  for (const uid of Object.values(UID)) docs[`profiles/${uid}`] = { id: uid, displayName: uid };
  return docs;
}

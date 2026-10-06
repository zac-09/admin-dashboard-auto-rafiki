import type { Dispute, SupportNote } from '@/types';

import { FIXTURE_NOW } from './contractFixtures';

const minutesAgo = (m: number) => new Date(FIXTURE_NOW.getTime() - m * 60_000).toISOString();

/** An open dispute on the completed battery job, so the support views have something real. */
export const DISPUTES_FIXTURE: Dispute[] = [
  {
    jobId: 'job_complete',
    status: 'open',
    customerId: 'u_customer_aisha',
    mechanicId: 'u_mech_okello',
    jobLabel: 'Dead battery, Nakawa, Jinja Road',
    reason: 'Customer says the battery died again the next morning and wants the fee back.',
    openedBy: 'staff-support',
    openedByEmail: 'support@autorafiki.test',
    openedAt: minutesAgo(90),
  },
];

export const NOTES_FIXTURE: Omit<SupportNote, 'id'>[] = [
  {
    jobId: 'job_complete',
    kind: 'dispute-opened',
    text: DISPUTES_FIXTURE[0]!.reason,
    authorUid: 'staff-support',
    authorEmail: 'support@autorafiki.test',
    createdAt: minutesAgo(90),
  },
  {
    jobId: 'job_complete',
    kind: 'note',
    text: 'Called Okello: says he only cleaned the terminals and told her the battery is old.',
    authorUid: 'staff-support',
    authorEmail: 'support@autorafiki.test',
    createdAt: minutesAgo(60),
  },
];

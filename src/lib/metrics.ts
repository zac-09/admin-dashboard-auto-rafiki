/**
 * What each headline number means, how it is worked out and why it matters: one wording for
 * the KPI cards, the trend charts and the Today page (the ⓘ next to each).
 */
export interface MetricDefinition {
  what: string;
  how: string;
  why?: string;
}

export const METRICS = {
  jobsPerMechanicPerWeek: {
    what: 'How many jobs the average verified mechanic completes in a week.',
    how: 'Completed jobs in the period, per week, divided by the number of verified mechanics.',
    why: 'The pilot’s make-or-break number: mechanics stay when they earn, and 3 a week makes a mechanic “active”.',
  },
  arrival: {
    what: 'The typical time from a customer asking for help to the mechanic arriving.',
    how: 'The median (middle value) over breakdowns that reached “arrived”. Bookings are left out: they are planned days ahead.',
    why: 'The north-star promise: help in under 30 minutes.',
  },
  jobsPerDay: {
    what: 'How many requests customers make per day.',
    how: 'Every request in the period, divided by the number of days.',
  },
  activeMechanics: {
    what: 'Verified mechanics who are really working.',
    how: 'Mechanics with at least 3 completed jobs in the last 7 days.',
  },
  acceptance: {
    what: 'How often a mechanic takes a request.',
    how: 'Of requests no longer waiting, the share a mechanic accepted (the rest expired or were cancelled first).',
    why: 'Low acceptance means customers are left without help: recruit where requests go unanswered.',
  },
  completion: {
    what: 'How often an accepted job is finished.',
    how: 'Of accepted jobs that ended, the share completed rather than cancelled.',
  },
  rating: {
    what: 'How customers rate mechanics.',
    how: 'The average of customer-to-mechanic stars given in the period.',
  },
  collected: {
    what: 'Subscription money recorded as paid for each week.',
    how: 'UGX 15,000 per verified mechanic per week, counted when ops record the payment. Voided payments are left out.',
    why: 'The company’s only revenue until Phase 2.',
  },
  unserved: {
    what: 'Requests that ended with nobody coming.',
    how: 'Of finished requests, the share cancelled before any mechanic accepted (the broadcast ran out or the customer gave up).',
    why: 'Each one is a customer we failed; see Coverage gaps for where they happen.',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRICS;

import { STATUS_LABELS } from '@/features/operations/board';
import { formatDate, formatUgx } from '@/lib/format';
import { SERVICE_LABELS, VETTING_LABELS } from '@/lib/labels';

import type { SearchResults as Results } from './search';

export interface ResultItem {
  key: string;
  to: string;
  kind: 'Job' | 'Customer' | 'Mechanic';
  title: string;
  detail: string;
}

/** Flattened, in display order: jobs, then people, then mechanics. */
export function resultItems(r: Results): ResultItem[] {
  return [
    ...r.jobs.map((j) => ({
      key: `job:${j.id}`,
      to: `/jobs/${j.id}`,
      kind: 'Job' as const,
      title: `${SERVICE_LABELS[j.request.service]}, ${j.request.location.label}`,
      detail: `${STATUS_LABELS[j.status]} · ${formatUgx(j.fee)} · ${formatDate(j.request.createdAt)}`,
    })),
    ...r.people.map((u) => ({
      key: `person:${u.id}`,
      to: `/support/people/${u.id}`,
      kind: 'Customer' as const,
      title: u.displayName || 'No name set',
      detail: `${u.phone} · ${u.roles.join(' and ')}`,
    })),
    ...r.mechanics.map((m) => ({
      key: `mechanic:${m.userId}`,
      to: `/support/people/${m.userId}`,
      kind: 'Mechanic' as const,
      title: m.businessName,
      detail: `${m.phone ?? 'No phone'} · ${VETTING_LABELS[m.vetting]} · ${m.jobsCompleted} jobs`,
    })),
  ];
}

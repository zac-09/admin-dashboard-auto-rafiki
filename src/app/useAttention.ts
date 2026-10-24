import { createContext, useContext } from 'react';

import { computeAlerts, type Alert } from '@/features/operations/alerts';
import { useActiveJobs, useLowRatings, useOnlineMechanics } from '@/features/operations/hooks';
import { overdueAccounts, type OverdueAccount } from '@/features/revenue/collections';
import { useSubscriptionInputs } from '@/features/revenue/hooks';
import { useAppSettings } from '@/features/settings/hooks';
import { useOpenDisputes } from '@/features/support/hooks';
import { useVettingQueue } from '@/features/vetting/hooks';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useNow } from '@/lib/useLive';
import { BROADCAST, type Dispute, type Job, type MechanicDoc } from '@/types';

/** What needs someone now, per module. `undefined` while loading or not this role's to see. */
export interface Attention {
  /** Applicants waiting for a vetting decision. */
  pending?: MechanicDoc[];
  /** The alert rail: stale requests, late mechanics, low ratings, uncovered requests. */
  alerts?: Alert[];
  openDisputes?: Dispute[];
  /** Verified mechanics with overdue subscription weeks. */
  overdue?: OverdueAccount[];
  /** Jobs not yet complete or cancelled. */
  activeJobs?: Job[];
  /** Mechanics online now (any vetting). */
  online?: MechanicDoc[];
}

/**
 * The counts behind the sidebar badges and the Today page. Reuses the same listeners and
 * queries as the modules (Firestore shares identical listeners), so it adds no reads of its own.
 */
export function useAttention(): Attention {
  const session = useSession();
  const now = useNow();
  const pending = useVettingQueue('pending');
  const active = useActiveJobs();
  const lowRatings = useLowRatings();
  const online = useOnlineMechanics();
  const appSettings = useAppSettings();
  const disputes = useOpenDisputes();
  const revenue = useSubscriptionInputs(can(session?.role, 'revenue.view'));

  const radiusKm =
    appSettings.effective?.settings.broadcast.initialRadiusKm ?? BROADCAST.initialRadiusKm;
  const alerts =
    active.status === 'ready' && lowRatings.status === 'ready' && online.status === 'ready'
      ? computeAlerts(active.data.jobs, lowRatings.data, now, { online: online.data, radiusKm })
      : undefined;

  return {
    pending: pending.data,
    alerts,
    activeJobs: active.status === 'ready' ? active.data.jobs : undefined,
    online: online.status === 'ready' ? online.data : undefined,
    openDisputes: disputes.status === 'ready' ? disputes.data : undefined,
    overdue: revenue.data
      ? overdueAccounts(revenue.data.mechanics, revenue.data.entries, revenue.data.payments, now)
      : undefined,
  };
}

/** Computed once by the shell; the sidebar and the Today page read it from here. */
export const AttentionContext = createContext<Attention>({});
export const useAttentionContext = () => useContext(AttentionContext);

/** Sidebar badge per module path: how many things wait there, and what they are. */
export function badgeFor(path: string, a: Attention): { count: number; noun: string } | null {
  const of = (list: readonly unknown[] | undefined, one: string, many: string) =>
    list && list.length ? { count: list.length, noun: list.length === 1 ? one : many } : null;
  switch (path) {
    case '/vetting':
      return of(a.pending, 'applicant waiting', 'applicants waiting');
    case '/operations':
      return of(a.alerts, 'open alert', 'open alerts');
    case '/support':
      return of(a.openDisputes, 'open dispute', 'open disputes');
    case '/revenue':
      return of(a.overdue, 'mechanic overdue', 'mechanics overdue');
    default:
      return null;
  }
}

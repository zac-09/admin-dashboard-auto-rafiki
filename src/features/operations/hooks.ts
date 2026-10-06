import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useRepositories } from '@/lib/repositories';
import { useLive } from '@/lib/useLive';
import type { Job, MechanicDoc, Rating } from '@/types';

import { CLOSED_WINDOW_MS, LOW_RATING_WINDOW_MS } from './constants';

/** Window starts are fixed at mount so the query key (and the listener) stays stable. */
function useSince(windowMs: number): string {
  const [since] = useState(() => new Date(Date.now() - windowMs).toISOString());
  return since;
}

export function useActiveJobs() {
  const { operations } = useRepositories();
  return useLive<Job[]>('active-jobs', (next, fail) => operations.subscribeActiveJobs(next, fail));
}

export function useClosedJobs() {
  const { operations } = useRepositories();
  const since = useSince(CLOSED_WINDOW_MS);
  return useLive<Job[]>(`closed-jobs:${since}`, (next, fail) =>
    operations.subscribeClosedJobs(since, next, fail),
  );
}

export function useOnlineMechanics() {
  const { operations } = useRepositories();
  return useLive<MechanicDoc[]>('online-mechanics', (next, fail) =>
    operations.subscribeOnlineMechanics(next, fail),
  );
}

export function useLowRatings() {
  const { operations } = useRepositories();
  const since = useSince(LOW_RATING_WINDOW_MS);
  return useLive<Rating[]>(`low-ratings:${since}`, (next, fail) =>
    operations.subscribeLowRatings(since, next, fail),
  );
}

export function useJob(jobId: string) {
  const { operations } = useRepositories();
  return useLive<Job | null>(`job:${jobId}`, (next, fail) =>
    operations.subscribeJob(jobId, next, fail),
  );
}

export function useUser(userId: string | undefined) {
  const { people } = useRepositories();
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => people.getUser(userId!),
    enabled: !!userId,
  });
}

/** Business names for the board, from the online list first, then one-off reads. */
export function useMechanicNames(ids: readonly string[]) {
  const { people } = useRepositories();
  const key = useMemo(() => [...new Set(ids)].sort(), [ids]);
  return useQuery({
    queryKey: ['mechanic-names', key],
    queryFn: async () => {
      const entries = await Promise.all(
        key.map(async (id) => [id, (await people.getMechanic(id))?.businessName ?? null] as const),
      );
      return new Map(entries);
    },
    enabled: key.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useMechanic(userId: string | undefined) {
  const { people } = useRepositories();
  return useQuery({
    queryKey: ['mechanic', userId],
    queryFn: () => people.getMechanic(userId!),
    enabled: !!userId,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useRepositories } from '@/lib/repositories';
import type { DecideVettingInput, VettingStatus } from '@/lib/vetting';
import type { MechanicDoc } from '@/types';

export const vettingKeys = {
  queue: (status: VettingStatus) => ['mechanics', 'vetting', status] as const,
  audit: ['audit', 'mechanic'] as const,
};

export function useVettingQueue(status: VettingStatus) {
  const repos = useRepositories();
  return useQuery({
    queryKey: vettingKeys.queue(status),
    queryFn: () => repos.mechanics.listByVetting(status),
  });
}

export function useMechanicAudit() {
  const repos = useRepositories();
  return useQuery({
    queryKey: vettingKeys.audit,
    queryFn: () => repos.audit.listMechanicEntries(),
  });
}

type LiveMechanic =
  | { status: 'loading'; mechanic: null; error: null }
  | { status: 'ready'; mechanic: MechanicDoc | null; error: null }
  | { status: 'error'; mechanic: null; error: Error };

/** Live mechanic doc, so a decision is always made against the current status. */
export function useMechanic(userId: string): LiveMechanic {
  const repos = useRepositories();
  const [state, setState] = useState<LiveMechanic & { userId: string }>({
    userId,
    status: 'loading',
    mechanic: null,
    error: null,
  });
  useEffect(
    () =>
      repos.mechanics.subscribe(
        userId,
        (mechanic) => setState({ userId, status: 'ready', mechanic, error: null }),
        (error) => setState({ userId, status: 'error', mechanic: null, error }),
      ),
    [repos, userId],
  );
  // A stale state from the previous userId reads as loading.
  return state.userId === userId ? state : { status: 'loading', mechanic: null, error: null };
}

export function useDecideVetting() {
  const repos = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DecideVettingInput) => repos.vetting.decide(input),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mechanics'] }),
        queryClient.invalidateQueries({ queryKey: vettingKeys.audit }),
      ]),
  });
}

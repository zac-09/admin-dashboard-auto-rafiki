import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useRepositories } from '@/lib/repositories';
import { useLive } from '@/lib/useLive';
import type { ChatMessage, Dispute, DisputeOutcome, Rating, SupportNote } from '@/types';

import { search } from './search';

/** `value`, settled for `ms` (search as you type without a read per keystroke). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function useSearch(query: string) {
  const { support } = useRepositories();
  const q = useDebounced(query.trim());
  return useQuery({
    queryKey: ['support-search', q],
    queryFn: () => search(support, q),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useMessages(jobId: string) {
  const { support } = useRepositories();
  return useLive<ChatMessage[]>(`messages:${jobId}`, (n, f) =>
    support.subscribeMessages(jobId, n, f),
  );
}

export function useJobRatings(jobId: string) {
  const { support } = useRepositories();
  return useLive<Rating[]>(`job-ratings:${jobId}`, (n, f) =>
    support.subscribeJobRatings(jobId, n, f),
  );
}

export function useNotes(jobId: string) {
  const { support } = useRepositories();
  return useLive<SupportNote[]>(`notes:${jobId}`, (n, f) => support.subscribeNotes(jobId, n, f));
}

export function useDispute(jobId: string) {
  const { support } = useRepositories();
  return useLive<Dispute | null>(`dispute:${jobId}`, (n, f) =>
    support.subscribeDispute(jobId, n, f),
  );
}

export function useOpenDisputes() {
  const { support } = useRepositories();
  return useLive<Dispute[]>('open-disputes', (n, f) => support.subscribeOpenDisputes(n, f));
}

export function usePerson(userId: string) {
  const { support } = useRepositories();
  return useQuery({
    queryKey: ['person', userId],
    queryFn: async () => {
      const [user, asCustomer, asMechanic, mechanics] = await Promise.all([
        support.getUser(userId),
        support.listJobsForCustomer(userId),
        support.listJobsForMechanic(userId),
        support.listMechanics(),
      ]);
      return {
        user,
        mechanic: mechanics.find((m) => m.userId === userId) ?? null,
        asCustomer,
        asMechanic,
      };
    },
  });
}

/** Notes, disputes: the live listeners pick up the result, so no cache invalidation needed. */
export function useAddNote(jobId: string) {
  const { support } = useRepositories();
  return useMutation({ mutationFn: (text: string) => support.addNote(jobId, text) });
}

export function useFlagDispute(jobId: string) {
  const { support } = useRepositories();
  return useMutation({ mutationFn: (reason: string) => support.flagDispute(jobId, reason) });
}

export function useResolveDispute(jobId: string) {
  const { support } = useRepositories();
  return useMutation({
    mutationFn: (input: { outcome: DisputeOutcome; note: string }) =>
      support.resolveDispute({ jobId, ...input }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useRepositories } from '@/lib/repositories';
import { useLive } from '@/lib/useLive';
import type { ReviewDocumentInput, VettingDocType, VettingDocument, VettingReviews } from '@/types';

import { vettingKeys } from './hooks';

export function useVettingDocuments(mechanicId: string) {
  const { vettingDocuments } = useRepositories();
  return useLive<Partial<Record<VettingDocType, VettingDocument>>>(
    `vetting-docs:${mechanicId}`,
    (n, f) => vettingDocuments.subscribeDocuments(mechanicId, n, f),
  );
}

export function useDocumentReviews(mechanicId: string) {
  const { vettingDocuments } = useRepositories();
  return useLive<VettingReviews>(`vetting-reviews:${mechanicId}`, (n, f) =>
    vettingDocuments.subscribeReviews(mechanicId, n, f),
  );
}

/** The file behind a record, as a URL for <img> / <iframe>; freed when the path changes or on unmount. */
export function useDocumentFile(storagePath: string, contentType: string) {
  const { vettingDocuments } = useRepositories();
  const query = useQuery({
    queryKey: ['vetting-file', storagePath],
    queryFn: () => vettingDocuments.loadFile(storagePath, contentType),
    staleTime: Infinity,
    gcTime: 0,
  });
  const revoke = query.data?.revoke;
  useEffect(() => () => revoke?.(), [revoke]);
  return query;
}

export function useReviewDocument() {
  const { vettingDocuments } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewDocumentInput) => vettingDocuments.review(input),
    onSettled: () => client.invalidateQueries({ queryKey: vettingKeys.audit }),
  });
}

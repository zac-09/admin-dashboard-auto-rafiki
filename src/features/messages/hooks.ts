import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Audience, OpsMessage } from '@/lib/mechanicMessages';
import { useRepositories } from '@/lib/repositories';

export const messageKeys = {
  sent: ['messages', 'sent'] as const,
  reads: (id: string) => ['messages', 'reads', id] as const,
};

export function useSentMessages() {
  const { messages } = useRepositories();
  return useQuery({ queryKey: messageKeys.sent, queryFn: () => messages.listSent() });
}

export function useReadCount(message: OpsMessage, enabled: boolean) {
  const { messages } = useRepositories();
  return useQuery({
    queryKey: messageKeys.reads(message.id),
    queryFn: () => messages.readCount(message),
    enabled,
  });
}

export function useSendMessage() {
  const { messages } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; audience: Audience }) =>
      messages.send(input),
    onSettled: () => client.invalidateQueries({ queryKey: messageKeys.sent }),
  });
}

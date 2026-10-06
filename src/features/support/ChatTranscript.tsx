import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonLines } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

import { useMessages } from './hooks';

/** The customer ↔ mechanic chat, read-only, as a conversation (customer left, mechanic right). */
export function ChatTranscript({ jobId }: { jobId: string }) {
  const live = useMessages(jobId);
  if (live.status === 'loading') return <SkeletonLines lines={3} />;
  if (live.status === 'error') {
    return <Notice tone="error">Could not load the chat: {live.error.message}</Notice>;
  }
  if (live.data.length === 0) {
    return <p className="text-sm text-muted">No messages on this job.</p>;
  }
  return (
    <ol className="flex flex-col gap-3" aria-label="Chat transcript">
      {live.data.map((m, i) => {
        const mechanic = m.senderRole === 'mechanic';
        return (
          <Reveal
            as="li"
            key={m.id}
            delay={staggerDelay(i, live.data.length)}
            className={`flex max-w-[85%] flex-col gap-1 ${mechanic ? 'self-end items-end' : 'self-start'}`}
          >
            <span className="micro-label">
              {mechanic ? 'Mechanic' : 'Customer'} · {formatDateTime(m.createdAt)}
            </span>
            <span
              className={`rounded-panel border px-3 py-2 text-sm ${
                mechanic ? 'border-primary bg-surface' : 'border-hairline'
              }`}
            >
              {m.text}
            </span>
          </Reveal>
        );
      })}
    </ol>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, staggerDelay, SuccessMoment } from '@/components/motion';
import { Notice, SkeletonPanel } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { OpsMessage } from '@/lib/mechanicMessages';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { Composer } from './Composer';
import { useReadCount, useSentMessages } from './hooks';

function Sent({ message, index, count }: { message: OpsMessage; index: number; count: number }) {
  const [check, setCheck] = useState(false);
  const reads = useReadCount(message, check);
  const n = message.recipientIds.length;
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-col gap-1 border-b border-hairline px-4 py-3 text-sm last:border-0"
    >
      <span className="font-semibold">{message.title}</span>
      <span className="whitespace-pre-line">{message.body}</span>
      <span className="text-xs text-muted">
        {formatDateTime(message.sentAt)} · {message.sentByEmail ?? message.sentBy} · to{' '}
        {message.audienceLabel} ({n} {n === 1 ? 'mechanic' : 'mechanics'}) · {message.pushed} by
        push
        {message.pushFailed ? `, ${message.pushFailed} push failed` : ''}
      </span>
      <span className="text-xs">
        {!check ? (
          <button type="button" onClick={() => setCheck(true)} className="min-h-8 underline">
            Who has read it?
          </button>
        ) : reads.isPending ? (
          'Checking…'
        ) : reads.error ? (
          `Could not check: ${reads.error.message}`
        ) : (
          `Read by ${reads.data} of ${n}`
        )}
      </span>
    </Reveal>
  );
}

/** `?lat=&lng=&place=` from an alert, when it is a real coordinate. */
function placeFrom(params: URLSearchParams) {
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lng'));
  if (
    !params.get('lat') ||
    !params.get('lng') ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, label: (params.get('place') ?? 'the request').slice(0, 120) };
}

/** Messages from operations to mechanics: write one, see what was sent and who read it. */
export function MessagesPage() {
  useDocumentTitle('Messages');
  const [params] = useSearchParams();
  const sent = useSentMessages();
  const [moment, setMoment] = useState<{ title: string; subtitle: string } | null>(null);

  return (
    <>
      {moment ? (
        <SuccessMoment
          status="success"
          title={moment.title}
          subtitle={moment.subtitle}
          onDone={() => setMoment(null)}
        />
      ) : null}
      <PageHeader label="Operations" title="Messages to mechanics" />
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Each message lands in the mechanic's in-app inbox and, when the app has a push token, as a
        notification on the "Messages from AutoRafiki" channel. Every send is audited.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <Composer
          initialTo={params.get('to')}
          initialPlace={placeFrom(params)}
          onSent={setMoment}
        />
        <section aria-label="Sent messages" className="panel">
          <h2 className="micro-label px-4 pt-4 pb-2">Sent</h2>
          {sent.isPending ? (
            <div className="p-4">
              <SkeletonPanel lines={3} title={false} />
            </div>
          ) : sent.error ? (
            <div className="p-4">
              <Notice tone="error">Could not load messages: {sent.error.message}</Notice>
            </div>
          ) : sent.data.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">Nothing sent yet.</p>
          ) : (
            <ul aria-label="Messages sent">
              {sent.data.map((m, i) => (
                <Sent key={m.id} message={m} index={i} count={sent.data.length} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

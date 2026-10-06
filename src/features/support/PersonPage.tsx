import { Link, useParams } from 'react-router';

import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonDetail } from '@/components/ui';
import { PhoneLink } from '@/features/vetting/PhoneLink';
import { STATUS_LABELS } from '@/features/operations/board';
import { formatDate, formatUgx } from '@/lib/format';
import { SERVICE_LABELS, VETTING_LABELS } from '@/lib/labels';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { Job } from '@/types';

import { usePerson } from './hooks';

function JobList({ title, jobs }: { title: string; jobs: Job[] }) {
  return (
    <section aria-label={title} className="panel p-5">
      <h2 className="micro-label mb-3 flex justify-between">
        <span>{title}</span>
        <span>{jobs.length}</span>
      </h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted">None.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {jobs.map((j, i) => (
            <Reveal as="li" key={j.id} delay={staggerDelay(i, jobs.length)}>
              <Link
                to={`/jobs/${j.id}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-control px-2 py-2 text-sm hover:bg-surface"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">
                    {SERVICE_LABELS[j.request.service]}, {j.request.location.label}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDate(j.request.createdAt)} · {formatUgx(j.fee)}
                  </span>
                </span>
                <span className="shrink-0 text-xs">{STATUS_LABELS[j.status]}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Everything about one app user: contact, roles, mechanic profile, every job either side. */
export function PersonPage() {
  const { userId = '' } = useParams();
  const person = usePerson(userId);
  const data = person.data;
  useDocumentTitle(data?.mechanic?.businessName ?? data?.user?.displayName ?? 'Person');

  const back = (
    <Link to="/support" className="mb-4 inline-block text-sm underline">
      Back to support
    </Link>
  );
  if (person.isPending)
    return (
      <>
        {back}
        <SkeletonDetail label="Loading person" />
      </>
    );
  if (person.error)
    return (
      <>
        {back}
        <Notice tone="error">{person.error.message}</Notice>
      </>
    );
  if (!data?.user && !data?.mechanic) {
    return (
      <>
        {back}
        <p className="panel p-6 text-sm">No app user with id {userId}.</p>
      </>
    );
  }
  const { user, mechanic, asCustomer, asMechanic } = data;

  return (
    <>
      {back}
      <header className="mb-6 flex flex-col gap-1">
        <span className="micro-label">{mechanic ? 'Mechanic and customer' : 'Customer'}</span>
        <h1 className="text-xl font-semibold">
          {mechanic?.businessName ?? user?.displayName ?? 'No name set'}
        </h1>
        <span className="text-sm">
          <PhoneLink phone={user?.phone ?? mechanic?.phone} />
        </span>
        {user?.createdAt ? (
          <span className="text-xs text-muted">Joined {formatDate(user.createdAt)}</span>
        ) : null}
        {mechanic ? (
          <span className="text-sm">
            {VETTING_LABELS[mechanic.vetting]} mechanic ·{' '}
            <Link to={`/vetting/${mechanic.userId}`} className="underline">
              Vetting record
            </Link>
          </span>
        ) : null}
      </header>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <JobList title="Jobs as a customer" jobs={asCustomer} />
        {mechanic || asMechanic.length > 0 ? (
          <JobList title="Jobs as a mechanic" jobs={asMechanic} />
        ) : null}
      </div>
    </>
  );
}

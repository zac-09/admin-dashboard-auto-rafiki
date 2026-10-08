import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Notice, Skeleton, SkeletonDetail } from '@/components/ui';
import { ChatTranscript } from '@/features/support/ChatTranscript';
import { DisputePanel } from '@/features/support/DisputePanel';
import { NotesPanel } from '@/features/support/NotesPanel';
import { RatingsList } from '@/features/support/RatingsList';
import { PhoneLink } from '@/features/vetting/PhoneLink';
import { formatUgx } from '@/lib/format';
import { SERVICE_LABELS, VEHICLE_LABELS } from '@/lib/labels';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useNow } from '@/lib/useLive';

import { CANCELLED_BY_LABELS, STATUS_LABELS } from './board';
import { useJob, useMechanic, useUser } from './hooks';
import { formatDuration, msInStatus } from './jobTime';
import { StepTrack } from './StepTrack';
import { InterventionsPanel } from './InterventionsPanel';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="panel p-5">
      <h2 className="micro-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4">
      <dt className="text-muted sm:w-36 sm:shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const session = useSession();
  const now = useNow();
  const live = useJob(jobId);
  useDocumentTitle(live.data ? `Job ${live.data.id}` : 'Job');
  const job = live.data ?? null;
  const customer = useUser(job?.request.customerId);
  const mechanic = useMechanic(job?.mechanicId);

  const navigate = useNavigate();
  // Jobs are opened from the board, alerts, search and people pages: go back to wherever it was.
  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/operations'))}
      className="mb-4 inline-block text-sm underline"
    >
      Back
    </button>
  );
  if (live.status === 'loading')
    return (
      <>
        {back}
        <SkeletonDetail label="Loading job" />
      </>
    );
  if (live.status === 'error')
    return (
      <>
        {back}
        <Notice tone="error">Could not load this job: {live.error.message}</Notice>
      </>
    );
  if (!job)
    return (
      <>
        {back}
        <p className="panel p-6 text-sm">No job with id {jobId}.</p>
      </>
    );

  const { request } = job;
  const closed = job.status === 'complete' || job.status === 'cancelled';
  const m = mechanic.data;

  return (
    <>
      {back}
      <header className="mb-6 flex flex-col gap-1">
        <span className="micro-label">Job {job.id}</span>
        <h1 className="text-xl font-semibold">
          {SERVICE_LABELS[request.service]} · {VEHICLE_LABELS[request.vehicle]}
        </h1>
        <p className="text-sm">
          <span className="font-semibold">{STATUS_LABELS[job.status]}</span>
          <span className="text-muted">
            {job.status === 'cancelled' && job.cancelledBy
              ? ` ${CANCELLED_BY_LABELS[job.cancelledBy] ?? ''}`
              : closed
                ? ''
                : ` for ${formatDuration(msInStatus(job, now))}`}
          </span>
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <Panel title="Request">
            <dl className="text-sm">
              <Row label="Location">
                {request.location.label}{' '}
                <a
                  className="text-xs underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${request.location.latitude},${request.location.longitude}`}
                >
                  Open in Google Maps
                </a>
              </Row>
              <Row label="Description">
                {request.description || <span className="text-muted">None</span>}
              </Row>
              <Row label="Fee">{formatUgx(job.fee)}</Row>
              <Row label="Broadcast radius">{job.radiusKm} km</Row>
              {job.distanceKm != null ? (
                <Row label="Distance driven">{job.distanceKm} km</Row>
              ) : null}
              {job.etaMinutes != null ? <Row label="ETA given">{job.etaMinutes} min</Row> : null}
            </dl>
          </Panel>

          <Panel title="Timeline">
            <StepTrack job={job} />
          </Panel>

          <Panel title="Chat">
            <ChatTranscript jobId={job.id} />
          </Panel>

          <Panel title="Ratings">
            <RatingsList jobId={job.id} />
          </Panel>

          <Panel title="People">
            <dl className="text-sm">
              <Row label="Customer">
                {customer.data ? (
                  <span className="flex flex-col">
                    <Link to={`/support/people/${customer.data.id}`} className="underline">
                      {customer.data.displayName || 'No name set'}
                    </Link>
                    <PhoneLink phone={customer.data.phone} />
                  </span>
                ) : (
                  <span className="text-muted">
                    {customer.isPending ? <Skeleton className="h-3.5 w-40" /> : request.customerId}
                  </span>
                )}
              </Row>
              <Row label="Mechanic">
                {!job.mechanicId ? (
                  <span className="text-muted">Not matched yet</span>
                ) : m ? (
                  <span className="flex flex-col">
                    <Link to={`/support/people/${m.userId}`} className="underline">
                      {m.businessName}
                    </Link>
                    <PhoneLink phone={m.phone} />
                    <Link to={`/vetting/${m.userId}`} className="text-xs text-muted underline">
                      Vetting record
                    </Link>
                  </span>
                ) : (
                  <span className="text-muted">
                    {mechanic.isPending ? <Skeleton className="h-3.5 w-40" /> : job.mechanicId}
                  </span>
                )}
              </Row>
            </dl>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Dispute">
            <DisputePanel jobId={job.id} />
          </Panel>
          <Panel title="Support notes">
            <NotesPanel jobId={job.id} />
          </Panel>
          <Panel title="Interventions">
            {can(session?.role, 'operations.intervene') ? (
              <InterventionsPanel job={job} mechanic={m} />
            ) : (
              <p className="text-sm text-muted">Your role can view jobs but not intervene.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

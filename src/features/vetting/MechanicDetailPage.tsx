import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { Notice } from '@/components/ui';
import { formatDateTime, formatUgx } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { ASSESSMENT_CHECKLIST } from '@/lib/vetting';
import type { MechanicDoc } from '@/types';

import { auditEntryLabel } from './auditLabels';
import { DecisionForm } from './DecisionForm';
import { useMechanic, useMechanicAudit } from './hooks';
import { ratingText, servicesText, vehiclesText } from './mechanicText';
import { PhoneLink } from './PhoneLink';
import { VettingStatusBadge } from './VettingStatusBadge';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel p-5" aria-label={title}>
      <h2 className="micro-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4">
      <dt className="text-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Location({ mechanic }: { mechanic: MechanicDoc }) {
  const loc = mechanic.lastKnownLocation;
  if (!loc) return <span className="text-muted">Never shared</span>;
  const coords = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  return (
    <span className="flex flex-col">
      <span>
        {loc.label} ({coords})
      </span>
      {mechanic.locationUpdatedAt ? (
        <span className="text-xs text-muted">
          Updated {formatDateTime(mechanic.locationUpdatedAt)}
        </span>
      ) : null}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline"
      >
        Open in Google Maps
      </a>
    </span>
  );
}

function History({ mechanicId }: { mechanicId: string }) {
  const audit = useMechanicAudit();
  if (audit.error)
    return <Notice tone="error">Could not load history: {audit.error.message}</Notice>;
  if (audit.isPending) return <p className="text-sm text-muted">Loading…</p>;
  const entries = audit.data.filter((e) => e.targetId === mechanicId);
  if (entries.length === 0) {
    return <p className="text-sm text-muted">No decisions recorded in the dashboard yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span aria-hidden className="mt-1.5 diamond text-muted" />
          <div className="flex flex-col gap-0.5">
            <span>
              <span className="font-semibold">{auditEntryLabel(e)}</span>
              <span className="text-muted">
                {' '}
                · {formatDateTime(e.at)} · {e.actorEmail ?? e.actorUid}
              </span>
            </span>
            <span>{e.reason}</span>
            {e.checklist ? (
              <span className="text-xs text-muted">
                Assessment: {e.checklist.length} of {ASSESSMENT_CHECKLIST.length} items confirmed
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MechanicDetailPage() {
  const { mechanicId = '' } = useParams();
  const session = useSession();
  const live = useMechanic(mechanicId);
  const [saved, setSaved] = useState<{ mechanicId: string; message: string } | null>(null);

  const back = (
    <Link to="/vetting" className="mb-4 inline-block text-sm underline">
      Back to vetting
    </Link>
  );
  if (live.status === 'loading') {
    return (
      <>
        {back}
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      </>
    );
  }
  if (live.status === 'error') {
    return (
      <>
        {back}
        <Notice tone="error">Could not load this mechanic: {live.error.message}</Notice>
      </>
    );
  }
  const m = live.mechanic;
  if (!m) {
    return (
      <>
        {back}
        <p className="panel p-6 text-sm">No mechanic profile with id {mechanicId}.</p>
      </>
    );
  }

  return (
    <>
      {back}
      <header className="mb-6 flex flex-col gap-2">
        <span className="micro-label">Mechanic</span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{m.businessName || 'Unnamed business'}</h1>
          <VettingStatusBadge status={m.vetting} />
        </div>
        <span className="text-sm">
          <PhoneLink phone={m.phone} />
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <Panel title="Profile">
            <dl className="text-sm">
              <Field label="Services">{servicesText(m)}</Field>
              <Field label="Vehicles">{vehiclesText(m)}</Field>
              <Field label="Call-out fee">{formatUgx(m.calloutFee)}</Field>
              <Field label="Rating">{ratingText(m)}</Field>
              <Field label="Jobs completed">{m.jobsCompleted}</Field>
              <Field label="Availability">
                {m.isOnline ? 'Online (available for jobs)' : 'Offline'}
                {m.isOnline && m.vetting !== 'verified' ? (
                  <span className="text-muted"> · gets no broadcasts until verified</span>
                ) : null}
              </Field>
              <Field label="Last known location">
                <Location mechanic={m} />
              </Field>
            </dl>
          </Panel>

          <Panel title="Documents">
            <p className="text-sm">No documents uploaded.</p>
            <p className="mt-1 text-xs text-muted">
              The app cannot upload national ID, certification or riding permit yet. Check them in
              person during the practical assessment.
            </p>
          </Panel>

          <Panel title="Vetting history">
            <History mechanicId={m.userId} />
          </Panel>
        </div>

        <Panel title="Decide">
          {saved?.mechanicId === m.userId ? (
            <div className="mb-4">
              <Notice tone="info">{saved.message}</Notice>
            </div>
          ) : null}
          {can(session?.role, 'vetting.decide') ? (
            // Remount on status change so a decision is never made against a stale status.
            <DecisionForm
              key={m.vetting}
              mechanic={m}
              onSaved={(message) => setSaved({ mechanicId: m.userId, message })}
            />
          ) : (
            <p className="text-sm text-muted">Your role can view vetting but not decide.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

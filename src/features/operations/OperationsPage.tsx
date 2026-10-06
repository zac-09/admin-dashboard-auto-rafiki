import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Notice } from '@/components/ui';
import { useNow } from '@/lib/useLive';

import { AlertRail } from './AlertRail';
import { computeAlerts } from './alerts';
import {
  useActiveJobs,
  useClosedJobs,
  useLowRatings,
  useMechanicNames,
  useOnlineMechanics,
} from './hooks';
import { JobBoard } from './JobBoard';
import { jobPins, mechanicPins } from './map/pins';

const OpsMap = lazy(() => import('./map/OpsMap'));

const VIEWS = [
  { id: 'board', label: 'Job board' },
  { id: 'map', label: 'Map' },
] as const;

export function OperationsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'board';
  const now = useNow();
  const active = useActiveJobs();
  const closed = useClosedJobs();
  const online = useOnlineMechanics();
  const lowRatings = useLowRatings();

  const activeJobs = useMemo(() => active.data ?? [], [active.data]);
  const onlineMechanics = useMemo(() => online.data ?? [], [online.data]);
  const alerts = computeAlerts(activeJobs, lowRatings.data ?? [], now);

  const allJobs = useMemo(() => [...activeJobs, ...(closed.data ?? [])], [activeJobs, closed.data]);
  const assigned = useMemo(
    () => allJobs.flatMap((j) => (j.mechanicId ? [j.mechanicId] : [])),
    [allJobs],
  );
  const looked = useMechanicNames(assigned);
  const names = new Map(looked.data ?? []);
  for (const m of onlineMechanics) names.set(m.userId, m.businessName);

  const failures = [
    ['jobs', active.error],
    ['closed jobs', closed.error],
    ['mechanics', online.error],
    ['ratings', lowRatings.error],
  ].filter((f): f is [string, Error] => !!f[1]);
  const receiving = onlineMechanics.filter((m) => m.vetting === 'verified').length;

  return (
    <>
      <PageHeader label="Control room" title="Live operations" />
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {active.status === 'loading'
          ? 'Connecting…'
          : `${activeJobs.length} active ${activeJobs.length === 1 ? 'job' : 'jobs'} · ${onlineMechanics.length} mechanics online (${receiving} receiving jobs)`}
      </p>
      {failures.map(([what, error]) => (
        <div key={what} className="mb-3">
          <Notice tone="error">
            Live {what} unavailable: {error.message}
          </Notice>
        </div>
      ))}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0">
          <nav aria-label="Operations views" className="mb-4 flex gap-1 border-b border-hairline">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-current={v.id === view ? 'page' : undefined}
                onClick={() => setParams(v.id === 'board' ? {} : { view: v.id })}
                className={`-mb-px min-h-10 border-b-2 px-3 text-sm ${
                  v.id === view
                    ? 'border-accent font-semibold text-primary'
                    : 'border-transparent text-muted hover:text-primary'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
          {view === 'board' ? (
            <JobBoard jobs={allJobs} alerts={alerts} now={now} mechanicNames={names} />
          ) : (
            <Suspense fallback={<p className="text-sm text-muted">Loading map…</p>}>
              <OpsMap
                jobs={jobPins(activeJobs, alerts)}
                mechanics={mechanicPins(onlineMechanics)}
              />
            </Suspense>
          )}
        </div>
        <AlertRail alerts={alerts} />
      </div>
    </>
  );
}

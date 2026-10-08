import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { AnimatedNumber } from '@/components/motion';
import { Notice, Skeleton, SkeletonBoard, Tabs } from '@/components/ui';
import { useAppSettings } from '@/features/settings/hooks';
import { DEFAULT_CATALOGUE } from '@/lib/catalogue';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useNow } from '@/lib/useLive';

import { AlertRail } from './AlertRail';
import { computeAlerts } from './alerts';
import {
  useActiveJobs,
  useClosedJobs,
  useLowRatings,
  useMechanicNames,
  useOnline,
  useOnlineMechanics,
} from './hooks';
import { JobBoard } from './JobBoard';
import { LiveBadge, type Connection } from './LiveBadge';
import { jobPins, mechanicPins } from './map/pins';

const OpsMap = lazy(() => import('./map/OpsMap'));

const VIEWS = [
  { id: 'board' as const, label: 'Job board' },
  { id: 'map' as const, label: 'Map' },
];

export function OperationsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'board';
  const now = useNow();
  const active = useActiveJobs();
  const closed = useClosedJobs();
  const online = useOnlineMechanics();
  const lowRatings = useLowRatings();
  const isOnline = useOnline();

  const activeJobs = useMemo(() => active.data?.jobs ?? [], [active.data]);
  const connection: Connection = !isOnline
    ? 'offline'
    : active.status === 'loading'
      ? 'connecting'
      : active.status === 'error' || active.data.fromCache
        ? 'reconnecting'
        : 'live';
  const onlineMechanics = useMemo(() => online.data ?? [], [online.data]);
  const alerts = computeAlerts(activeJobs, lowRatings.data ?? [], now);
  // The alert count in the tab title, so staff see it from any other tab.
  useDocumentTitle(alerts.length > 0 ? `(${alerts.length}) Live operations` : 'Live operations');

  const allJobs = useMemo(() => [...activeJobs, ...(closed.data ?? [])], [activeJobs, closed.data]);
  const assigned = useMemo(
    () => allJobs.flatMap((j) => (j.mechanicId ? [j.mechanicId] : [])),
    [allJobs],
  );
  const looked = useMechanicNames(assigned);
  const names = new Map(looked.data ?? []);
  for (const m of onlineMechanics) names.set(m.userId, m.businessName);
  // Cart items on cards resolve through the published catalogue (the app's defaults until then).
  const appSettings = useAppSettings();
  const catalogue = appSettings.effective?.settings.catalogue ?? DEFAULT_CATALOGUE;

  const failures = [
    ['jobs', active.error],
    ['closed jobs', closed.error],
    ['mechanics', online.error],
    ['ratings', lowRatings.error],
  ].filter((f): f is [string, Error] => !!f[1]);
  const receiving = onlineMechanics.filter((m) => m.vetting === 'verified').length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader label="Control room" title="Live operations" />
        <LiveBadge state={connection} />
      </div>
      <p className="mb-4 text-sm text-muted">
        {active.status === 'loading' ? (
          <Skeleton className="h-3.5 w-80 max-w-full" />
        ) : (
          <>
            <AnimatedNumber value={activeJobs.length} /> active{' '}
            {activeJobs.length === 1 ? 'job' : 'jobs'} ·{' '}
            <AnimatedNumber value={onlineMechanics.length} /> mechanics online (
            <AnimatedNumber value={receiving} /> receiving jobs)
          </>
        )}
      </p>
      {failures.map(([what, error]) => (
        <div key={what} className="mb-3">
          <Notice tone="error">
            Live {what} unavailable: {error.message}
          </Notice>
        </div>
      ))}
      <div className="flex flex-col gap-4">
        {/* Alerts first and full width: they are the operator's to-do list; the board gets
            the whole width below so more status columns fit. */}
        <AlertRail alerts={alerts} />
        <div className="min-w-0">
          <Tabs
            label="Operations views"
            value={view}
            onChange={(id) => setParams(id === 'board' ? {} : { view: id })}
            items={VIEWS}
          />
          {view === 'board' ? (
            active.status === 'loading' ? (
              <SkeletonBoard />
            ) : (
              <JobBoard
                jobs={allJobs}
                alerts={alerts}
                now={now}
                mechanicNames={names}
                catalogue={catalogue}
              />
            )
          ) : (
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Loading map"
                  className="panel skeleton h-[60vh] min-h-80"
                />
              }
            >
              <OpsMap
                jobs={jobPins(activeJobs, alerts)}
                mechanics={mechanicPins(onlineMechanics)}
              />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}

import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, staggerDelay } from '@/components/motion';
import { toast } from '@/components/toast/toastStore';
import { Button, Notice, SkeletonPanel, Tabs } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { ProblemReport } from '@/types';

import { browserName } from './browser';
import { useProblemReports } from './hooks';

const VIEWS = [
  { id: 'open' as const, label: 'Open' },
  { id: 'resolved' as const, label: 'Resolved' },
];
type View = (typeof VIEWS)[number]['id'];

function Report({ report, index, count }: { report: ProblemReport; index: number; count: number }) {
  const { problems } = useRepositories();
  const resolve = useMutation({
    mutationFn: () => problems.resolve(report.id),
    onSuccess: () => toast({ title: 'Report resolved', body: report.description.slice(0, 80) }),
  });
  const c = report.context;
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-col gap-3 border-b border-hairline p-4 last:border-0 sm:flex-row sm:items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm whitespace-pre-wrap">{report.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
          <dt>From</dt>
          <dd>
            {report.reporterEmail ?? report.reporterUid} ({ROLE_LABELS[report.reporterRole]}),{' '}
            {formatDateTime(report.at)}
          </dd>
          <dt>Page</dt>
          <dd className="truncate">
            <Link to={c.path} className="underline">
              {c.pageTitle || c.path}
            </Link>
          </dd>
          <dt>Browser</dt>
          <dd>
            {browserName(c.userAgent)}, {c.viewport}, {c.theme} mode
          </dd>
          {report.resolvedAt ? (
            <>
              <dt>Resolved</dt>
              <dd>
                {formatDateTime(report.resolvedAt)} by {report.resolvedByEmail ?? report.resolvedBy}
              </dd>
            </>
          ) : null}
        </dl>
        {resolve.error ? <Notice tone="error">{resolve.error.message}</Notice> : null}
      </div>
      {report.resolvedAt ? null : (
        <Button
          variant="secondary"
          loading={resolve.isPending}
          onClick={() => resolve.mutate()}
          aria-label={`Mark resolved: ${report.description.slice(0, 40)}`}
        >
          Mark resolved
        </Button>
      )}
    </Reveal>
  );
}

/** What the team reported with "Report a problem" (admins). */
export function ProblemReportsPage() {
  useDocumentTitle('Problem reports');
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'open') as View;
  const reports = useProblemReports();
  const all = reports.data ?? [];
  const open = all.filter((r) => !r.resolvedAt);
  const resolved = all.filter((r) => r.resolvedAt);
  const shown = view === 'open' ? open : resolved;

  return (
    <>
      <PageHeader label="Admin" title="Problem reports" />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        What the team sent with “Report a problem”, with the page, browser and screen it happened
        on. Open the page link to see it for yourself.
      </p>
      <Tabs
        label="Report views"
        value={view}
        onChange={(id) => setParams(id === 'open' ? {} : { view: id })}
        items={VIEWS.map((v) => ({
          ...v,
          count: reports.status === 'ready' ? (v.id === 'open' ? open : resolved).length : null,
        }))}
      />
      {reports.status === 'loading' ? (
        <SkeletonPanel lines={4} />
      ) : reports.status === 'error' ? (
        <Notice tone="error">Could not load reports: {reports.error.message}</Notice>
      ) : shown.length === 0 ? (
        <Reveal key={view} className="panel flex items-center gap-3 p-6 text-sm text-muted">
          <span aria-hidden className="diamond text-success" />
          {view === 'open' ? 'No open reports.' : 'Nothing resolved yet.'}
        </Reveal>
      ) : (
        <Reveal key={view} from="fade" className="panel">
          <ul aria-label={view === 'open' ? 'Open reports' : 'Resolved reports'}>
            {shown.map((r, i) => (
              <Report key={r.id} report={r} index={i} count={shown.length} />
            ))}
          </ul>
        </Reveal>
      )}
    </>
  );
}

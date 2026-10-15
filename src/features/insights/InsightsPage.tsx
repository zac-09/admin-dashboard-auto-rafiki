import { Link, useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Notice, SkeletonPanel, Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { CoverageTab } from './CoverageTab';
import { DemandTab } from './DemandTab';
import { useInsightsInputs } from './hooks';
import { MechanicsTab } from './MechanicsTab';
import { TrendsTab } from './TrendsTab';

export type InsightsData = NonNullable<ReturnType<typeof useInsightsInputs>['data']>;

const VIEWS = [
  { id: 'trends' as const, label: 'Trends' },
  { id: 'coverage' as const, label: 'Coverage gaps' },
  { id: 'demand' as const, label: 'Demand & supply' },
  { id: 'mechanics' as const, label: 'Mechanic scorecards' },
];
type View = (typeof VIEWS)[number]['id'];

/** Is the pilot working, where are the gaps, and which mechanics carry it. */
export function InsightsPage() {
  useDocumentTitle('Insights');
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'trends') as View;
  const inputs = useInsightsInputs();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader label="Business" title="Insights" />
        <Link
          to="/report"
          className="inline-flex min-h-10 items-center rounded-control border border-hairline px-3 text-sm font-semibold hover:border-primary"
        >
          Weekly pilot report
        </Link>
      </div>
      <Tabs
        label="Insight views"
        value={view}
        onChange={(id) => setParams(id === 'trends' ? {} : { view: id })}
        items={VIEWS}
      />
      {inputs.isPending ? (
        <div role="status" aria-label="Loading insights" className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonPanel key={i} lines={4} />
          ))}
        </div>
      ) : inputs.error ? (
        <Notice tone="error">Could not load insights: {inputs.error.message}</Notice>
      ) : view === 'trends' ? (
        <TrendsTab data={inputs.data} />
      ) : view === 'coverage' ? (
        <CoverageTab data={inputs.data} />
      ) : view === 'demand' ? (
        <DemandTab data={inputs.data} />
      ) : (
        <MechanicsTab data={inputs.data} />
      )}
    </>
  );
}

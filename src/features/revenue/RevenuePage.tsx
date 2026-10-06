import { useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { KpisTab } from './KpisTab';
import { SubscriptionsTab } from './SubscriptionsTab';

const VIEWS = [
  { id: 'subscriptions' as const, label: 'Subscriptions' },
  { id: 'kpis' as const, label: 'KPIs' },
];

export function RevenuePage() {
  useDocumentTitle('Revenue');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'kpis' ? 'kpis' : 'subscriptions';
  return (
    <>
      <PageHeader label="Business" title="Revenue & analytics" />
      <Tabs
        label="Revenue views"
        value={view}
        onChange={(id) => setParams(id === 'subscriptions' ? {} : { view: id })}
        items={VIEWS}
      />
      {view === 'subscriptions' ? <SubscriptionsTab /> : <KpisTab />}
    </>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Freshness } from '@/components/network/Freshness';
import { Reveal, staggerDelay } from '@/components/motion';
import { SortButtons, useSort } from '@/components/table';
import { Notice, Skeleton, SkeletonTable, Tabs } from '@/components/ui';
import { INSIGHT_WEEKS, useInsightsInputs } from '@/features/insights/hooks';
import { PhoneLink } from '@/features/vetting/PhoneLink';
import { formatDate } from '@/lib/format';
import { useRepositories } from '@/lib/repositories';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { usePreference } from '@/lib/preferences';

import {
  CUSTOMER_RULES,
  overview,
  SEGMENT_LABELS,
  segmentsOf,
  summarizeCustomers,
  type CustomerSummary,
  type Segment,
} from './customers';

const SEGMENTS: Segment[] = ['never-served', 'lapsed', 'repeat', 'flagged'];
const HINTS: Record<Segment, string> = {
  'never-served':
    'Asked for help and nobody came, every time. Call them: they are the most likely to give up on AutoRafiki.',
  lapsed: `Served before, but no request in ${CUSTOMER_RULES.lapsedAfterDays} days.`,
  repeat: 'Completed two or more jobs: the customers the pilot is for.',
  flagged: `Mechanics rated them ${CUSTOMER_RULES.flaggedRating} stars or lower on average (at least ${CUSTOMER_RULES.minRatings} ratings). Check the jobs before acting.`,
};
const SHOWN = 50;

function useNames(ids: readonly string[]) {
  const { people } = useRepositories();
  return useQuery({
    queryKey: ['customers', 'names', ids],
    queryFn: async () =>
      new Map(await Promise.all(ids.map(async (id) => [id, await people.getUser(id)] as const))),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
}

function Row({
  c,
  user,
  index,
  count,
}: {
  c: CustomerSummary;
  user: { displayName?: string; phone?: string } | null | undefined;
  index: number;
  count: number;
}) {
  const r = c.ratedByMechanics;
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-hairline px-4 py-3 text-sm last:border-0"
    >
      <span className="flex min-w-48 flex-col">
        <Link to={`/support/people/${c.customerId}`} className="font-semibold underline">
          {user === undefined ? (
            <Skeleton className="inline-block h-3.5 w-32 align-middle" />
          ) : (
            user?.displayName || 'No name set'
          )}
        </Link>
        <span className="text-xs">
          <PhoneLink phone={user?.phone} />
        </span>
      </span>
      <span>
        {c.requests} {c.requests === 1 ? 'request' : 'requests'} · {c.completed} completed ·{' '}
        {c.unanswered} unanswered
      </span>
      <span className="text-xs text-muted">
        First {formatDate(c.firstRequestAt)} · last {formatDate(c.lastRequestAt)}
        {r.count
          ? ` · rated ★ ${(Math.round(r.average! * 10) / 10).toFixed(1)} by mechanics (${r.count})`
          : ''}
      </span>
    </Reveal>
  );
}

/** Who the customers are, who keeps coming back, and who is about to give up. */
export function CustomersPage() {
  useDocumentTitle('Customers');
  const inputs = useInsightsInputs();
  const [segment, setSegment] = usePreference<Segment>(
    'customers.segment',
    'never-served',
    (v): v is Segment => SEGMENTS.includes(v as Segment),
  );

  const summaries = inputs.data ? summarizeCustomers(inputs.data.jobs, inputs.data.ratings) : [];
  const now = inputs.data?.now ?? new Date();
  const bySegment = new Map(
    SEGMENTS.map((s) => [
      s,
      summaries
        .filter((c) => segmentsOf(c, now).includes(s))
        .sort((a, b) => b.lastRequestAt.localeCompare(a.lastRequestAt)),
    ]),
  );
  const {
    sorted: list,
    sort,
    toggle,
  } = useSort(
    bySegment.get(segment) ?? [],
    {
      requests: (c) => -c.requests,
      completed: (c) => -c.completed,
      unanswered: (c) => -c.unanswered,
    },
    undefined,
    'customers',
  );
  const shown = list.slice(0, SHOWN);
  const names = useNames(shown.map((c) => c.customerId));
  const o = overview(summaries, now);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader label="Support" title="Customers" />
        <Freshness
          updatedAt={inputs.dataUpdatedAt}
          fetching={inputs.isFetching}
          onRefresh={() => inputs.refetch()}
        />
      </div>
      {inputs.isPending ? (
        <SkeletonTable rows={5} columns={3} label="Loading customers" />
      ) : inputs.error ? (
        <Notice tone="error">Could not load customers: {inputs.error.message}</Notice>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Everyone who requested help in the last {INSIGHT_WEEKS} weeks: {o.customers}{' '}
            {o.customers === 1 ? 'customer' : 'customers'}, {o.newLast7Days} new in the last 7 days
            {o.repeatShare === null
              ? ''
              : `, ${Math.round(o.repeatShare * 100)}% of those served came back for a second job`}
            .
          </p>
          <Tabs
            label="Customer segments"
            value={segment}
            onChange={setSegment}
            items={SEGMENTS.map((s) => ({
              id: s,
              label: SEGMENT_LABELS[s],
              count: bySegment.get(s)?.length ?? 0,
            }))}
          />
          <p className="mb-3 text-sm">{HINTS[segment]}</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SortButtons
              options={[
                { key: 'requests', label: 'Most requests' },
                { key: 'completed', label: 'Most completed' },
                { key: 'unanswered', label: 'Most unanswered' },
              ]}
              sort={sort}
              onSort={toggle}
            />
            <span className="text-xs text-muted">
              Most recent first unless sorted. Looking for one person? Use Search (⌘K).
            </span>
          </div>
          {list.length === 0 ? (
            <Reveal className="panel p-6 text-sm text-muted">Nobody in this group.</Reveal>
          ) : (
            <>
              <ul key={segment} className="panel" aria-label={SEGMENT_LABELS[segment]}>
                {shown.map((c, i) => (
                  <Row
                    key={c.customerId}
                    c={c}
                    user={names.data ? (names.data.get(c.customerId) ?? null) : undefined}
                    index={i}
                    count={shown.length}
                  />
                ))}
              </ul>
              {list.length > SHOWN ? (
                <p className="mt-2 text-xs text-muted">
                  Showing the first {SHOWN} of {list.length}.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}

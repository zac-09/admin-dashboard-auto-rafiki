import { Link } from 'react-router';
import { useState } from 'react';

import { PageHeader } from '@/app/pages/PageHeader';
import { AnimatedNumber, Reveal, staggerDelay } from '@/components/motion';
import { Notice, Skeleton, SkeletonLines } from '@/components/ui';
import { daysSince, formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { useOpenDisputes, useSearch } from './hooks';
import { resultItems } from './resultItems';
import { ResultRow } from './SearchResults';
import { MIN_QUERY } from './search';

function OpenDisputes() {
  const live = useOpenDisputes();
  return (
    <section aria-label="Open disputes" className="panel p-5">
      <h2 className="micro-label mb-3 flex items-center justify-between">
        <span>Open disputes</span>
        {live.status === 'ready' ? <AnimatedNumber value={live.data.length} /> : null}
      </h2>
      {live.status === 'loading' ? (
        <SkeletonLines lines={3} />
      ) : live.status === 'error' ? (
        <Notice tone="error">Could not load disputes: {live.error.message}</Notice>
      ) : live.data.length === 0 ? (
        <p className="flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="diamond text-success" />
          No open disputes.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {live.data.map((d, i) => (
            <Reveal as="li" key={d.jobId} delay={staggerDelay(i, live.data.length)}>
              <Link
                to={`/jobs/${d.jobId}`}
                className="flex min-h-12 items-start gap-3 rounded-control px-2 py-2 text-sm hover:bg-surface"
              >
                <span aria-hidden className="mt-1.5 diamond sonar text-warning" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{d.jobLabel}</span>
                  <span className="truncate text-muted">{d.reason}</span>
                  <span className="text-xs text-muted">
                    Open{' '}
                    {daysSince(d.openedAt) === 0 ? 'since today' : `${daysSince(d.openedAt)} days`}{' '}
                    · {formatDateTime(d.openedAt)}
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SupportPage() {
  useDocumentTitle('Support');
  const [query, setQuery] = useState('');
  const results = useSearch(query);
  const items = results.data ? resultItems(results.data) : [];
  const typed = query.trim().length >= MIN_QUERY;

  return (
    <>
      <PageHeader label="Customer support" title="Support" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-label="Search" className="flex flex-col gap-3">
          <label htmlFor="support-search" className="micro-label">
            Phone number, job id or business name
          </label>
          <input
            id="support-search"
            type="search"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="0772 123 456 · job_… · Okello"
            className="min-h-12 rounded-control border border-hairline bg-background px-4 text-base placeholder:text-muted focus:border-primary"
          />
          <p className="text-xs text-muted">
            Tip: press <kbd className="rounded-control border border-hairline px-1">⌘K</kbd>{' '}
            anywhere to search. Plate search arrives when the app records plates.
          </p>
          {!typed ? null : results.isPending ? (
            <div role="status" aria-label="Searching" className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : results.error ? (
            <Notice tone="error">Search failed: {results.error.message}</Notice>
          ) : items.length === 0 ? (
            <Reveal className="panel p-5 text-sm text-muted">
              Nothing matches “{results.data?.query}”. Phone numbers match exactly; names match any
              part.
            </Reveal>
          ) : (
            <ul
              role="listbox"
              aria-label="Search results"
              className="panel flex flex-col gap-1 p-2"
            >
              {items.map((item, i) => (
                <ResultRow key={item.key} item={item} index={i} count={items.length} />
              ))}
            </ul>
          )}
        </section>
        <OpenDisputes />
      </div>
    </>
  );
}

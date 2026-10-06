import type { ReactNode } from 'react';

/**
 * Loading placeholders in the design language (ported from the app's Skeleton): shaped like
 * the content they stand in for, so the real rows can Reveal into the same place. Prefer these
 * to spinners everywhere.
 */
export function Skeleton({
  className = 'h-3.5 w-full',
  round = false,
}: {
  className?: string;
  round?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`skeleton block ${round ? 'rounded-full' : 'rounded-control'} ${className}`}
    />
  );
}

const LINE_WIDTHS = ['w-[72%]', 'w-[48%]', 'w-[88%]', 'w-[36%]'];

function Loading({
  label = 'Loading',
  children,
  className = '',
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label} aria-live="polite" className={className}>
      {children}
    </div>
  );
}

export function SkeletonLines({ lines = 2 }: { lines?: number }) {
  return (
    <span className="flex flex-1 flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${LINE_WIDTHS[i % LINE_WIDTHS.length]}`} />
      ))}
    </span>
  );
}

/** Hairline panel of placeholder lines, the same shape as a loaded panel. */
export function SkeletonPanel({ lines = 3, title = true }: { lines?: number; title?: boolean }) {
  return (
    <div className="panel flex flex-col gap-4 p-5" aria-hidden>
      {title ? <Skeleton className="h-3 w-24" /> : null}
      <SkeletonLines lines={lines} />
    </div>
  );
}

/** A data table still loading: header bar plus rows at the real 40px+ row height. */
export function SkeletonTable({
  rows = 5,
  columns = 5,
  label,
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <Loading label={label} className="panel overflow-hidden">
      <div className="flex gap-6 border-b border-hairline px-3 py-3" aria-hidden>
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex min-h-12 items-center gap-6 border-b border-hairline px-3 last:border-0"
          aria-hidden
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton
              key={c}
              className={`h-3.5 flex-1 ${c === 0 ? 'max-w-48' : ''} ${(r + c) % 3 === 0 ? 'opacity-70' : ''}`}
            />
          ))}
        </div>
      ))}
    </Loading>
  );
}

/** The job board while its live feeds connect: column headers over card-shaped blocks. */
export function SkeletonBoard({
  columns = 5,
  label = 'Connecting to live jobs',
}: {
  columns?: number;
  label?: string;
}) {
  const cardsPer = [2, 1, 2, 0, 1];
  return (
    <Loading label={label} className="overflow-hidden">
      <div className="grid auto-cols-[13.5rem] grid-flow-col gap-3" aria-hidden>
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-4" />
            </div>
            {Array.from({ length: cardsPer[c % cardsPer.length]! }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-control border border-hairline p-3"
              >
                <Skeleton className="h-3.5 w-[70%]" />
                <Skeleton className="h-3 w-[90%]" />
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** A detail page loading: title block, then the main column and the side panel. */
export function SkeletonDetail({ label }: { label?: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={2} />
        </div>
        <SkeletonPanel lines={3} />
      </div>
    </Loading>
  );
}

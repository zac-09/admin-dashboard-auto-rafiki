import type { SortState } from './sort';

/** Sort choices for a list that is not a table: same behaviour as clicking a column header. */
export function SortButtons<K extends string>({
  options,
  sort,
  onSort,
}: {
  options: readonly { key: K; label: string }[];
  sort: SortState<K>;
  onSort: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort by">
      <span className="micro-label">Sort by</span>
      {options.map((o) => {
        const active = sort.key === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSort(o.key)}
            className="inline-flex min-h-10 items-center gap-1 rounded-control border border-hairline px-3 text-sm aria-pressed:border-primary aria-pressed:font-semibold"
          >
            {o.label}
            {active ? (
              <span aria-hidden className="text-[10px]">
                {sort.dir === 'asc' ? '▲' : '▼'}
              </span>
            ) : null}
            {active ? (
              <span className="sr-only">{sort.dir === 'asc' ? ', ascending' : ', descending'}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

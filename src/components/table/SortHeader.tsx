import type { SortState } from './sort';

/**
 * A column header that sorts. The arrow shows the direction; aria-sort tells screen readers,
 * and the button says what clicking does.
 */
export function SortHeader<K extends string>({
  column,
  label,
  sort,
  onSort,
  className = '',
}: {
  column: K;
  label: string;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-8 items-center gap-1 rounded-control hover:text-primary ${
          active ? 'text-primary' : ''
        }`}
      >
        {label}
        <span aria-hidden className={`text-[10px] ${active ? '' : 'opacity-40'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

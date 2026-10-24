import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  /** null: the list's own order (oldest application first, most overdue first…). */
  key: K | null;
  dir: SortDir;
}
export type SortValue = string | number | null | undefined;

/** Compares two values: numbers by size, text by locale; blanks always last. */
export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const blankA = a === null || a === undefined || a === '';
  const blankB = b === null || b === undefined || b === '';
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
  const order =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? order : -order;
}

/** The next state when a column header is clicked: ascending, descending, then back to default. */
export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, dir: 'asc' };
  return current.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' };
}

/**
 * Sorts `rows` by the clicked column, keeping the list's own order for ties (and when no
 * column is chosen).
 */
export function useSort<T, K extends string>(
  rows: readonly T[],
  columns: Record<K, (row: T) => SortValue>,
  initial: SortState<K> = { key: null, dir: 'asc' },
) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    if (!sort.key) return [...rows];
    const value = columns[sort.key];
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => compareValues(value(a.row), value(b.row), sort.dir) || a.index - b.index)
      .map((x) => x.row);
    // `columns` is a literal recreated each render; the sort only depends on its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { sorted, sort, setSort, toggle: (key: K) => setSort((s) => nextSort(s, key)) };
}

/** Lower-case, accents and extra spaces removed: "  Okéllo " matches "okello". */
function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Every word of `query` appears somewhere in `fields`. Digits also match ignoring spaces and
 * a leading 0 or +256, so "0772 123" finds +256772123456.
 */
export function matchesQuery(
  query: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const words = normalise(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalise(fields.filter(Boolean).join(' '));
  const digits = haystack.replace(/\D/g, '');
  return words.every((word) => {
    if (haystack.includes(word)) return true;
    const d = word.replace(/\D/g, '').replace(/^(256|0)/, '');
    return d.length >= 3 && /^[\d+]+$/.test(word) && digits.includes(d);
  });
}

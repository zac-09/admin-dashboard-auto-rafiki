import { Link } from 'react-router';

import { Reveal, staggerDelay } from '@/components/motion';

import type { ResultItem } from './resultItems';

export function ResultRow({
  item,
  index,
  count,
  active = false,
  onPick,
}: {
  item: ResultItem;
  index: number;
  count: number;
  active?: boolean;
  onPick?: () => void;
}) {
  return (
    <Reveal as="li" delay={staggerDelay(index, count)} role="none">
      <Link
        to={item.to}
        onClick={onPick}
        role="option"
        aria-selected={active}
        className={`flex min-h-12 items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors ${
          active ? 'border-primary bg-surface' : 'border-transparent hover:bg-surface'
        }`}
      >
        <span className="micro-label w-20 shrink-0">{item.kind}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{item.title}</span>
          <span className="truncate text-xs text-muted">{item.detail}</span>
        </span>
      </Link>
    </Reveal>
  );
}

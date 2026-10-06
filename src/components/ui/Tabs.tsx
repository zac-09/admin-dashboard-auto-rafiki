import { motion } from 'motion/react';
import { useId } from 'react';

import { AnimatedNumber, springs } from '@/components/motion';

import { Skeleton } from './Skeleton';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Count shown beside the label; `null` while loading (skeleton). */
  count?: number | null;
}

/** Underlined tabs whose accent indicator slides between items. */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const indicator = useId();
  return (
    // One line that scrolls sideways on narrow screens (no wrapping into a second row).
    <nav
      aria-label={label}
      className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-hairline"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(item.id)}
            className={`relative flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm whitespace-nowrap transition-colors ${
              active ? 'font-semibold text-primary' : 'text-muted hover:text-primary'
            }`}
          >
            {item.label}
            {item.count === undefined ? null : item.count === null ? (
              <Skeleton className="h-2.5 w-4" />
            ) : (
              <span className="text-xs text-muted">
                <AnimatedNumber value={item.count} />
              </span>
            )}
            {active ? (
              <motion.span
                layoutId={`tab-${indicator}`}
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                transition={springs.snappy}
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

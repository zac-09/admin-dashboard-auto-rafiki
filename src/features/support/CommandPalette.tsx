import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { springs, timings } from '@/components/motion';
import { Skeleton } from '@/components/ui';

import { useSearch } from './hooks';
import { usePalette } from './paletteStore';
import { resultItems } from './resultItems';
import { ResultRow } from './SearchResults';
import { MIN_QUERY } from './search';

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useSearch(query);
  const items = results.data ? resultItems(results.data) : [];
  const typed = query.trim().length >= MIN_QUERY;
  const current = Math.min(active, Math.max(items.length - 1, 0));

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[current]) {
      e.preventDefault();
      navigate(items[current].to);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <motion.button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-primary/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: timings.fade }}
        exit={{ opacity: 0, transition: timings.exit }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="panel relative w-full max-w-xl bg-background shadow-xl"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: springs.settle }}
        exit={{ opacity: 0, y: -8, transition: timings.exit }}
      >
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="palette-results"
          aria-label="Search by phone number, job id or business name"
          placeholder="Phone, job id or business name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="min-h-14 w-full rounded-t-panel border-b border-hairline bg-transparent px-4 text-base placeholder:text-muted focus:outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!typed ? (
            <p className="px-2 py-3 text-xs text-muted">
              Type at least {MIN_QUERY} characters. ↑ ↓ to move, Enter to open, Esc to close.
            </p>
          ) : results.isPending ? (
            <div role="status" aria-label="Searching" className="flex flex-col gap-2 p-1">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">Nothing matches “{query.trim()}”.</p>
          ) : (
            <ul
              id="palette-results"
              role="listbox"
              aria-label="Search results"
              className="flex flex-col gap-1"
            >
              {items.map((item, i) => (
                <ResultRow
                  key={item.key}
                  item={item}
                  index={i}
                  count={items.length}
                  active={i === current}
                  onPick={onClose}
                />
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** ⌘K / Ctrl+K from anywhere in the dashboard. */
export function CommandPalette() {
  const { open, setOpen } = usePalette();
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      } else if (e.key === 'Escape' && usePalette.getState().open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);
  return (
    <AnimatePresence>{open ? <Palette onClose={() => setOpen(false)} /> : null}</AnimatePresence>
  );
}

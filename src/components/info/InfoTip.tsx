import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { METRICS, type MetricId } from '@/lib/metrics';

import { springs, timings } from '../motion/presets';

/**
 * A small ⓘ beside a number that explains it. Opens on click or keyboard (not hover only, so
 * it works on phones and for screen readers); Escape or a click elsewhere closes it.
 */
export function InfoTip({ metric, label }: { metric: MetricId; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const def = METRICS[metric];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex normal-case">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`About ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-6 items-center justify-center rounded-full text-xs text-muted hover:text-primary aria-expanded:text-primary"
      >
        <span
          aria-hidden
          className="flex size-4 items-center justify-center rounded-full border border-current text-[10px] leading-none font-semibold"
        >
          i
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="note"
            className="absolute top-full left-0 z-30 mt-1 flex w-72 max-w-[80vw] flex-col gap-1.5 rounded-panel border border-hairline bg-background p-3 text-left text-xs font-normal tracking-normal text-primary shadow-lg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: springs.snappy }}
            exit={{ opacity: 0, transition: timings.exit }}
          >
            <span className="font-semibold">{def.what}</span>
            <span className="text-muted">{def.how}</span>
            {'why' in def ? <span>{def.why}</span> : null}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

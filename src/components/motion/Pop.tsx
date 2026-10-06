import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import { springs } from './presets';

/** Scale-pops its children whenever `trigger` changes (a count ticking, a status flipping). */
export function Pop({
  trigger,
  amount = 1.2,
  children,
  className,
}: {
  trigger: unknown;
  amount?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      key={String(trigger)}
      className={`inline-block ${className ?? ''}`}
      initial={reduced ? false : { scale: amount }}
      animate={{ scale: 1 }}
      transition={springs.pop}
    >
      {children}
    </motion.span>
  );
}

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

import { springs, timings } from './presets';

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'> {
  /** Element to render; `li` / `tr` for list and table rows. */
  as?: 'div' | 'li' | 'tr' | 'section';
  /** ms before the entrance starts; stagger siblings with `staggerDelay(index, count)`. */
  delay?: number;
  /** `up` = panel rising; `down` = header settling; `scale` = seals and marks. */
  from?: 'up' | 'down' | 'fade' | 'scale';
}

const OFFSET = 12;

/**
 * Spring entrance (the app's Reveal). Under reduced motion it is a short fade: no travel, no
 * scale, but content never just pops in either.
 */
export function Reveal({ as = 'div', delay = 0, from = 'up', transition, ...rest }: RevealProps) {
  // The element-specific motion components share the div props this wrapper accepts.
  const Component = motion[as] as typeof motion.div;
  const reduced = useReducedMotion();
  const hidden =
    reduced || from === 'fade'
      ? { opacity: 0 }
      : from === 'scale'
        ? { opacity: 0, scale: 0.6 }
        : { opacity: 0, y: from === 'up' ? OFFSET : -OFFSET };
  const spring = from === 'scale' ? springs.pop : springs.settle;
  return (
    <Component
      initial={hidden}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, ...(reduced ? {} : { y: OFFSET / 2 }), transition: timings.exit }}
      transition={
        transition ??
        (reduced
          ? { ...timings.fade, delay: delay / 1000 }
          : { ...spring, delay: delay / 1000, opacity: { ...timings.fade, delay: delay / 1000 } })
      }
      {...rest}
    />
  );
}

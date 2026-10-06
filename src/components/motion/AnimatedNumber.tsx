import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** Counts up or down to `value` (queue counts, totals): the odometer feel without the odometer. */
export function AnimatedNumber({
  value,
  format = String,
  duration = 0.7,
}: {
  value: number;
  format?: (value: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.25, 1, 0.5, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduced]);

  // The final value is always what assistive tech reads; the count-up is decoration.
  return (
    <span aria-label={format(value)}>
      <span aria-hidden>{format(reduced ? value : shown)}</span>
    </span>
  );
}

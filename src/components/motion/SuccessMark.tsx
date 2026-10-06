import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

import { ms, springs } from './presets';

const BURST = 8;
/** Time from `success` until the tick has finished drawing (ring close + check stroke). */
const DRAWN_AFTER_MS = 620;

/**
 * Spinner → tick, ported from the app. Pending: a 70% accent arc spins. Success: the arc
 * closes into a full ring with a spring, the tick draws itself, and eight brand diamonds
 * burst outward. Under reduced motion the ring and tick simply appear (no spin, no burst).
 */
export function SuccessMark({
  status,
  size = 120,
  onDrawn,
}: {
  status: 'pending' | 'success';
  size?: number;
  onDrawn?: () => void;
}) {
  const reduced = useReducedMotion();
  const success = status === 'success';

  useEffect(() => {
    if (!success || !onDrawn) return;
    const timer = setTimeout(onDrawn, ms(reduced ? 0 : DRAWN_AFTER_MS));
    return () => clearTimeout(timer);
  }, [success, onDrawn, reduced]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={success ? 'Done' : 'Working'}
    >
      {success && !reduced
        ? Array.from({ length: BURST }, (_, i) => {
            const angle = (i / BURST) * Math.PI * 2;
            const at = (d: number) => ({
              x: Math.cos(angle) * size * d,
              y: Math.sin(angle) * size * d,
            });
            return (
              <motion.span
                key={i}
                aria-hidden
                className="absolute size-2 bg-accent"
                style={{ left: size / 2 - 4, top: size / 2 - 4, rotate: 45 }}
                initial={{ ...at(0.42), opacity: 0, scale: 0.4 }}
                animate={{
                  ...at(0.78),
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.6],
                }}
                transition={{
                  delay: 0.22,
                  duration: 0.7,
                  ease: [0.5, 1, 0.89, 1],
                  times: [0, 0.4, 1],
                }}
              />
            );
          })
        : null}
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
        animate={
          success
            ? { rotate: 0, scale: reduced ? 1 : [1, 1.12, 1] }
            : reduced
              ? { rotate: 0 }
              : { rotate: 360 }
        }
        transition={
          success
            ? { rotate: { duration: 0.2 }, scale: springs.pop }
            : { rotate: { duration: 0.9, ease: 'linear', repeat: Infinity } }
        }
      >
        <motion.circle
          cx={50}
          cy={50}
          r={44}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          className="stroke-accent"
          transform="rotate(-90 50 50)"
          initial={{ pathLength: 0.7 }}
          animate={{ pathLength: success ? 1 : 0.7 }}
          transition={springs.settle}
        />
      </motion.svg>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden
      >
        <motion.path
          d="M30 52 l13 13 l27 -30"
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={success ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  delay: 0.18,
                  duration: 0.42,
                  ease: [0.33, 1, 0.68, 1],
                  opacity: { delay: 0.18, duration: 0.05 },
                }
          }
        />
      </svg>
    </div>
  );
}

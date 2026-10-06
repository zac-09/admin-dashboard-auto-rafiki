import { AnimatePresence, motion } from 'motion/react';

import { timings } from '@/components/motion';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'offline';

const COPY: Record<Connection, { label: string; dot: string; pulse: boolean }> = {
  connecting: { label: 'Connecting…', dot: 'bg-muted', pulse: false },
  live: { label: 'Live', dot: 'bg-success text-success', pulse: true },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning', pulse: false },
  offline: { label: 'Offline: showing last known state', dot: 'bg-danger', pulse: false },
};

/**
 * Whether the control room is current. The pulsing dot means listeners are connected; any other
 * state is spelled out, never shown by colour alone.
 */
export function LiveBadge({ state }: { state: Connection }) {
  const copy = COPY[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-h-8 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${copy.dot} ${copy.pulse ? 'sonar' : ''}`}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: timings.fade }}
          exit={{ opacity: 0, y: -4, transition: timings.exit }}
        >
          {copy.label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

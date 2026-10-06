import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { ms, timings } from './presets';
import { Reveal } from './Reveal';
import { SuccessMark } from './SuccessMark';

export interface SuccessMomentProps {
  /** While `pending`, the ring spins; flip to `success` to play the tick. */
  status: 'pending' | 'success';
  title: string;
  pendingTitle?: string;
  subtitle?: string;
  /** Called once after the tick has drawn and `holdMs` has passed. */
  onDone?: () => void;
  holdMs?: number;
}

/**
 * Full-screen moment, ported from the app: spinner → animated tick → title rises → hold →
 * onDone. For outcomes worth marking: signing in, approving or suspending a mechanic.
 */
export function SuccessMoment({
  status,
  title,
  pendingTitle = 'One moment…',
  subtitle,
  onDone,
  holdMs = 1100,
}: SuccessMomentProps) {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!drawn || !onDone) return;
    const timer = setTimeout(onDone, ms(holdMs));
    return () => clearTimeout(timer);
  }, [drawn, holdMs, onDone]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: timings.fade }}
      exit={{ opacity: 0, transition: timings.exit }}
    >
      <SuccessMark status={status} onDrawn={() => setDrawn(true)} />
      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          <Reveal key="done" delay={250} className="flex flex-col items-center gap-2 text-center">
            <p className="text-2xl font-light">{title}</p>
            {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          </Reveal>
        ) : (
          <Reveal key="pending" from="fade">
            <p className="text-sm text-muted">{pendingTitle}</p>
          </Reveal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

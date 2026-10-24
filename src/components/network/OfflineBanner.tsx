import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { useOnline } from '@/lib/useOnline';

import { springs, timings } from '../motion/presets';
import { toast } from '../toast/toastStore';
import { Spinner } from '../ui/Spinner';

/**
 * On every page: says plainly when the connection drops (live boards stop updating and saves
 * fail), and confirms when it is back.
 */
export function OfflineBanner() {
  const online = useOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast({ title: 'Back online', body: 'Live views are catching up.', tone: 'info' });
    }
  }, [online]);

  return (
    <AnimatePresence>
      {online ? null : (
        <motion.div
          role="status"
          className="sticky top-0 z-20 mb-4 flex items-center gap-3 rounded-panel border border-warning bg-background px-4 py-3 text-sm print:hidden"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, transition: springs.settle }}
          exit={{ opacity: 0, transition: timings.exit }}
        >
          <Spinner className="size-4 text-warning" />
          <span>
            <span className="font-semibold">You are offline. Reconnecting…</span>{' '}
            <span className="text-muted">
              Live boards are paused and saving will fail until the connection is back.
            </span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

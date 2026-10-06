import { motion } from 'motion/react';

import { springs, staggerDelay } from '@/components/motion';
import { formatDateTime } from '@/lib/format';
import type { Job, JobStatus } from '@/types';

import { STATUS_LABELS } from './board';
import { formatDuration, timelineSteps } from './jobTime';

const PATH: readonly JobStatus[] = [
  'requested',
  'matched',
  'enroute',
  'arrived',
  'working',
  'complete',
];

/**
 * The job's timeline as a step track (the app's progress rail): a rail through every step,
 * filled up to now; done steps solid, the current one pulsing, the rest of the path still to
 * come shown faintly. Shape and text carry the state, not colour alone.
 */
export function StepTrack({ job }: { job: Job }) {
  const done = timelineSteps(job);
  const closed = job.status === 'complete' || job.status === 'cancelled';
  const remaining = closed ? [] : PATH.slice(PATH.indexOf(job.status) + 1);
  const total = done.length + remaining.length;

  return (
    <ol className="relative flex flex-col">
      {done.map((step, i) => {
        const current = !closed && i === done.length - 1;
        const last = i === total - 1;
        return (
          <motion.li
            key={`${step.status}-${i}`}
            className="relative flex gap-4 pb-5 last:pb-0"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springs.settle, delay: staggerDelay(i, total) / 1000 }}
          >
            {!last ? (
              <span
                aria-hidden
                className={`absolute top-4 left-[5px] h-full w-0.5 ${current ? 'bg-hairline' : 'bg-accent'}`}
              />
            ) : null}
            <span
              aria-hidden
              className={`relative mt-1.5 size-3 shrink-0 rotate-45 ${
                current ? 'sonar bg-accent text-accent' : 'bg-primary'
              }`}
            />
            <span className="flex flex-col text-sm">
              <span className="font-semibold">
                {STATUS_LABELS[step.status]}
                {current ? <span className="font-normal text-muted"> · now</span> : null}
              </span>
              <span className="text-muted">
                {formatDateTime(step.at)}
                {step.durationMs != null ? ` · lasted ${formatDuration(step.durationMs)}` : ''}
              </span>
            </span>
          </motion.li>
        );
      })}
      {remaining.map((status, j) => {
        const i = done.length + j;
        return (
          <motion.li
            key={status}
            className="relative flex gap-4 pb-5 last:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: staggerDelay(i, total) / 1000 }}
          >
            {i < total - 1 ? (
              <span aria-hidden className="absolute top-4 left-[5px] h-full w-0.5 bg-hairline" />
            ) : null}
            <span
              aria-hidden
              className="relative mt-1.5 size-3 shrink-0 rotate-45 border border-hairline bg-background"
            />
            <span className="flex flex-col text-sm text-muted">
              <span>{STATUS_LABELS[status]}</span>
              <span className="text-xs">Not yet</span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

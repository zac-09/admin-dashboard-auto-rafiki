import type { Booking, Job } from '../types/domain';

import { SERVICE_LABELS } from './labels';

/**
 * Booked servicing (app contract 2026-10-16) is an ordinary job carrying request.booking:
 * planned for a two-hour window days ahead, so never an urgent broadcast.
 */
export function isBooking(job: Pick<Job, 'request'>): job is Pick<Job, 'request'> & {
  request: Job['request'] & { booking: Booking };
} {
  return !!job.request.booking;
}

/** What to call the job: the package for a booking, the fault for a breakdown. */
export function jobTitle(job: Pick<Job, 'request'>): string {
  return job.request.booking?.packageLabel ?? SERVICE_LABELS[job.request.service];
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Sat 18 Oct, 10:00–12:00" (Kampala time). */
export function bookingWindow(booking: Pick<Booking, 'scheduledFor' | 'windowMinutes'>): string {
  const start = new Date(booking.scheduledFor);
  const end = new Date(start.getTime() + booking.windowMinutes * 60_000);
  return `${DAY.format(start)}, ${TIME.format(start)}–${TIME.format(end)}`;
}

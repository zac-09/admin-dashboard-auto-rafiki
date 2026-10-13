import { kampalaMidnight } from '@/lib/subscriptions';

/** "5 Oct" for a Kampala Monday. */
export function shortWeek(weekStart: string): string {
  return new Date(kampalaMidnight(weekStart) + 3 * 3_600_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

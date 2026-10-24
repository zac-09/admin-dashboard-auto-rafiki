/** Money is UGX, whole shillings: `UGX 35,000`. */
export function formatUgx(value: number): string {
  return `UGX ${Math.round(value).toLocaleString('en-US')}`;
}

/** Ops staff work in Kampala time regardless of the laptop's timezone. */
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `6 Oct 2026, 12:00` (Kampala time). */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** `6 Oct 2026` (Kampala time). */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/** Whole days between `iso` and `now`, floored at 0. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** "just now", "4 min ago", "2 h ago", "3 days ago": how long since `ms` (epoch). */
export function formatAgo(ms: number, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const EXACT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** `Sat, 24 Oct 2026, 14:05:32 (Kampala time)`: the exact moment behind a relative time. */
export function formatExact(iso: string): string {
  return `${EXACT.format(new Date(iso))} (Kampala time)`;
}

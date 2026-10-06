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

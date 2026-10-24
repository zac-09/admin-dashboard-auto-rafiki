/** Kampala is UTC+3 all year. */
const KAMPALA_MS = 3 * 3_600_000;

/** "Good morning" / "Good afternoon" / "Good evening", by the hour in Kampala. */
export function greeting(now: Date): string {
  const hour = new Date(now.getTime() + KAMPALA_MS).getUTCHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

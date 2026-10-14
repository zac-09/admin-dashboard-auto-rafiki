/**
 * Number plates as the app stores them on requests (contract 2026-10-14; mirrors the app's
 * src/lib/plate.ts): uppercase, no spaces, ^[A-Z0-9]{2,10}$.
 */
export const PLATE_PATTERN = /^[A-Z0-9]{2,10}$/;

/** "uba 123x" → "UBA123X"; undefined when it can't be a stored plate. */
export function normalisePlate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const plate = raw.toUpperCase().replace(/\s+/g, '');
  return PLATE_PATTERN.test(plate) ? plate : undefined;
}

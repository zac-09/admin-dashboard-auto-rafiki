import type { ServiceType, Ugx } from '@/types';

/**
 * Upfront call-out prices (UGX) as COMPILED INTO THE APP (its src/lib/pricing.ts). Read-only
 * here: the app does not read a settings doc yet, so the dashboard can only display these.
 * Jobs store their own `fee`, fixed when requested.
 */
export const APP_CALLOUT_PRICES: Readonly<Record<ServiceType, Ugx>> = {
  'flat-tyre': 30_000,
  battery: 35_000,
  engine: 50_000,
  fuel: 25_000,
  lockout: 30_000,
  towing: 80_000,
  other: 30_000,
};

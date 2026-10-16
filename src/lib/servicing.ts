import type { ServicePackage } from '../types/domain';

/**
 * MIRRORED from the app (auto-rafiki src/lib/servicing.ts): the bookable servicing packages
 * the app uses until settings/app → servicing is published. Ids are stable keys stored on
 * jobs (request.booking.packageId): add new ids, never rename. The app marks these PRICES as
 * PLACEHOLDERS for Isaac to confirm.
 */
export const DEFAULT_SERVICING: readonly ServicePackage[] = [
  {
    id: 'oil-change',
    label: 'Oil and filter change',
    price: 120_000,
    description: 'Engine oil and oil filter replaced, levels checked.',
  },
  {
    id: 'minor-service',
    label: 'Minor service',
    price: 180_000,
    description: 'Oil and filter, air filter, fluids, tyres and lights checked.',
  },
  {
    id: 'full-service',
    label: 'Full service',
    price: 350_000,
    description: 'Minor service plus plugs, brakes, belts and a road test.',
  },
  {
    id: 'brake-check',
    label: 'Brake check',
    price: 50_000,
    description: 'Pads, discs and brake fluid inspected; you get a written report.',
  },
  {
    id: 'battery-check',
    label: 'Battery and charging check',
    price: 30_000,
    description: 'Battery, alternator and terminals tested and cleaned.',
  },
];

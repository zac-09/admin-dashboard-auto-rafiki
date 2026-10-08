/**
 * MIRRORED from the app repo (auto-rafiki) src/lib/catalogue.ts DEFAULT_CATALOGUE: the
 * compiled default behind the request cart. The settings editor seeds from it. Ids are stable
 * keys stored on jobs (request.items), so ops add new ids and never rename or remove one.
 */
import type { CatalogueItem } from '../types/domain';

export const DEFAULT_CATALOGUE: readonly CatalogueItem[] = [
  { id: 'tyre-puncture', label: 'Puncture repair', service: 'flat-tyre' },
  { id: 'tyre-tube', label: 'New tube', service: 'flat-tyre' },
  { id: 'tyre-spare-fit', label: 'Fit my spare wheel', service: 'flat-tyre' },
  { id: 'tyre-new', label: 'New tyre', service: 'flat-tyre' },
  { id: 'tyre-valve', label: 'Valve replacement', service: 'flat-tyre' },
  { id: 'tyre-balance', label: 'Wheel balancing', service: 'flat-tyre' },

  { id: 'battery-jump', label: 'Jump start', service: 'battery' },
  { id: 'battery-new', label: 'New battery', service: 'battery' },
  { id: 'battery-terminals', label: 'Clean or replace terminals', service: 'battery' },
  { id: 'battery-alternator', label: 'Alternator check', service: 'battery' },

  { id: 'engine-diagnosis', label: 'Fault diagnosis', service: 'engine' },
  { id: 'engine-overheating', label: 'Overheating or coolant', service: 'engine' },
  { id: 'engine-fan-belt', label: 'Fan belt', service: 'engine' },
  { id: 'engine-spark-plugs', label: 'Spark plugs', service: 'engine' },
  { id: 'engine-oil', label: 'Engine oil top-up', service: 'engine' },
  { id: 'engine-starter', label: 'Starter motor', service: 'engine' },

  { id: 'fuel-delivery', label: 'Fuel delivery', service: 'fuel' },
  { id: 'fuel-pump', label: 'Fuel pump check', service: 'fuel' },
  { id: 'fuel-filter', label: 'Fuel filter', service: 'fuel' },
  { id: 'fuel-wrong', label: 'Wrong fuel drained', service: 'fuel' },

  { id: 'lockout-unlock', label: 'Unlock the door', service: 'lockout' },
  { id: 'lockout-key-stuck', label: 'Key stuck in ignition', service: 'lockout' },
  { id: 'lockout-spare-key', label: 'Fetch my spare key', service: 'lockout' },

  { id: 'tow-garage', label: 'Tow to a garage', service: 'towing' },
  { id: 'tow-home', label: 'Tow to my home', service: 'towing' },
  { id: 'tow-winch', label: 'Winch out or recovery', service: 'towing' },
  { id: 'tow-flatbed', label: 'Flatbed needed', service: 'towing' },

  { id: 'other-brakes', label: 'Brakes', service: 'other' },
  { id: 'other-lights', label: 'Lights', service: 'other' },
  { id: 'other-wipers', label: 'Wipers', service: 'other' },
  { id: 'other-ac', label: 'Air conditioning', service: 'other' },
  { id: 'other-suspension', label: 'Suspension or shocks', service: 'other' },
  { id: 'other-electrical', label: 'Electrical fault', service: 'other' },
  { id: 'other-clutch', label: 'Clutch or gearbox', service: 'other' },
];

/** Compiled support contacts (the app's fallback). The phone is a PLACEHOLDER: ops set the real line. */
export const DEFAULT_SUPPORT = {
  emergencyPhone: '+256700000000',
  email: 'support@autorafiki.app',
} as const;

export const PLACEHOLDER_EMERGENCY_PHONE = DEFAULT_SUPPORT.emergencyPhone;

/** Labels for job cards and detail: a catalogue id → its label, falling back to the raw id. */
export function itemLabels(ids: readonly string[], catalogue: readonly CatalogueItem[]): string[] {
  const byId = new Map(catalogue.map((c) => [c.id, c.label]));
  return ids.map((id) => byId.get(id) ?? id);
}

/**
 * settings/app: ops-tunable prices and broadcast values. The dashboard writes it (the audited
 * `updateSettings` callable); the app reads it live and falls back to its compiled defaults
 * when the document is missing or invalid. These checks mirror the app's zod schema
 * (auto-rafiki src/lib/settings/schema.ts) exactly, so the dashboard can never publish a
 * document the app would reject and silently ignore.
 */
import { BROADCAST, type AppSettings, type ServiceType } from '../types/domain';

import { APP_CALLOUT_PRICES } from './pricing';

export const SETTINGS_COLLECTION = 'settings';
export const SETTINGS_DOC = 'app';

export const SERVICES = Object.keys(APP_CALLOUT_PRICES) as ServiceType[];

export const LIMITS = {
  price: { min: 1_000, max: 1_000_000 },
  radiusKm: { min: 1, max: 30 },
  windowMs: { min: 30_000, max: 600_000 },
} as const;

/** The app's compiled values: what the app uses until a valid settings/app exists. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  prices: { ...APP_CALLOUT_PRICES },
  broadcast: {
    initialRadiusKm: BROADCAST.initialRadiusKm,
    expandedRadiusKm: BROADCAST.expandedRadiusKm,
    windowMs: BROADCAST.windowMs,
  },
};

export type SettingsCheck =
  { ok: true; settings: AppSettings } | { ok: false; errors: Record<string, string> };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates the editable part (prices + broadcast). Field paths key the error messages. */
export function checkAppSettings(raw: unknown): SettingsCheck {
  const errors: Record<string, string> = {};
  const input = (raw ?? {}) as {
    prices?: Record<string, unknown>;
    broadcast?: Record<string, unknown>;
  };
  const prices = {} as Record<ServiceType, number>;
  for (const s of SERVICES) {
    const v = input.prices?.[s];
    if (!isNum(v) || !Number.isInteger(v) || v < LIMITS.price.min || v > LIMITS.price.max) {
      errors[`prices.${s}`] = 'Whole shillings from UGX 1,000 to 1,000,000.';
    } else prices[s] = v;
  }
  const b = input.broadcast ?? {};
  const radius = (key: 'initialRadiusKm' | 'expandedRadiusKm') => {
    const v = b[key];
    if (!isNum(v) || v < LIMITS.radiusKm.min || v > LIMITS.radiusKm.max) {
      errors[`broadcast.${key}`] = 'From 1 to 30 km.';
      return null;
    }
    return v;
  };
  const initial = radius('initialRadiusKm');
  const expanded = radius('expandedRadiusKm');
  if (initial !== null && expanded !== null && expanded < initial) {
    errors['broadcast.expandedRadiusKm'] = 'Must be at least the first radius.';
  }
  const w = b.windowMs;
  if (!isNum(w) || !Number.isInteger(w) || w < LIMITS.windowMs.min || w > LIMITS.windowMs.max) {
    errors['broadcast.windowMs'] = 'From 30 seconds to 10 minutes.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    settings: {
      version: 1,
      prices,
      broadcast: {
        initialRadiusKm: initial as number,
        expandedRadiusKm: expanded as number,
        windowMs: w as number,
      },
    },
  };
}

/** Reads a stored document the way the app does: whole-document fallback when invalid. */
export function effectiveSettings(stored: unknown): {
  settings: AppSettings;
  source: 'remote' | 'default';
} {
  if (!stored || (stored as { version?: unknown }).version !== 1) {
    return { settings: DEFAULT_APP_SETTINGS, source: 'default' };
  }
  const check = checkAppSettings(stored);
  return check.ok
    ? {
        settings: {
          ...check.settings,
          updatedAt: (stored as AppSettings).updatedAt,
          updatedBy: (stored as AppSettings).updatedBy,
        },
        source: 'remote',
      }
    : { settings: DEFAULT_APP_SETTINGS, source: 'default' };
}

/** Human list of what changes between two settings ("Dead battery UGX 35,000 → 40,000"). */
export function settingsChanges(
  before: AppSettings,
  after: AppSettings,
  labels: Record<ServiceType, string>,
): string[] {
  const ugx = (n: number) => `UGX ${n.toLocaleString('en-US')}`;
  const changes: string[] = [];
  for (const s of SERVICES) {
    if (before.prices[s] !== after.prices[s]) {
      changes.push(`${labels[s]}: ${ugx(before.prices[s])} → ${ugx(after.prices[s])}`);
    }
  }
  const b0 = before.broadcast;
  const b1 = after.broadcast;
  if (b0.initialRadiusKm !== b1.initialRadiusKm) {
    changes.push(`First broadcast radius: ${b0.initialRadiusKm} km → ${b1.initialRadiusKm} km`);
  }
  if (b0.expandedRadiusKm !== b1.expandedRadiusKm) {
    changes.push(`Widened radius: ${b0.expandedRadiusKm} km → ${b1.expandedRadiusKm} km`);
  }
  if (b0.windowMs !== b1.windowMs) {
    changes.push(`Broadcast window: ${b0.windowMs / 1000} s → ${b1.windowMs / 1000} s`);
  }
  return changes;
}

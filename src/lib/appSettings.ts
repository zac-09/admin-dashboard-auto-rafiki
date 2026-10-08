/**
 * settings/app: ops-tunable prices and broadcast values. The dashboard writes it (the audited
 * `updateSettings` callable); the app reads it live and falls back to its compiled defaults
 * when the document is missing or invalid. These checks mirror the app's zod schema
 * (auto-rafiki src/lib/settings/schema.ts) exactly, so the dashboard can never publish a
 * document the app would reject and silently ignore.
 */
import {
  BROADCAST,
  type AppSettings,
  type CatalogueItem,
  type ServiceType,
  type UgPhone,
} from '../types/domain';

import { DEFAULT_CATALOGUE, DEFAULT_SUPPORT } from './catalogue';
import { APP_CALLOUT_PRICES } from './pricing';

export const SETTINGS_COLLECTION = 'settings';
export const SETTINGS_DOC = 'app';

export const SERVICES = Object.keys(APP_CALLOUT_PRICES) as ServiceType[];

export const LIMITS = {
  price: { min: 1_000, max: 1_000_000 },
  radiusKm: { min: 1, max: 30 },
  windowMs: { min: 30_000, max: 600_000 },
  catalogue: { maxItems: 200, maxLabel: 40 },
} as const;

/** The app's rules for a catalogue id (a slug) and a Ugandan E.164 number. */
export const CATALOGUE_ID = /^[a-z0-9-]{2,40}$/;
export const UG_PHONE = /^\+256\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The app's compiled values: what the app uses until a valid settings/app exists. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  prices: { ...APP_CALLOUT_PRICES },
  broadcast: {
    initialRadiusKm: BROADCAST.initialRadiusKm,
    expandedRadiusKm: BROADCAST.expandedRadiusKm,
    windowMs: BROADCAST.windowMs,
  },
  support: { ...DEFAULT_SUPPORT },
  catalogue: [...DEFAULT_CATALOGUE],
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

  // support and catalogue are optional in the document (older ones lack them): absent means
  // the app's compiled defaults, so the dashboard treats absent as the defaults too.
  const sup = (input as { support?: Record<string, unknown> }).support;
  let support: AppSettings['support'] = { ...DEFAULT_SUPPORT };
  if (sup !== undefined) {
    const phone = typeof sup.emergencyPhone === 'string' ? sup.emergencyPhone.trim() : '';
    const email = typeof sup.email === 'string' ? sup.email.trim() : '';
    if (!UG_PHONE.test(phone))
      errors['support.emergencyPhone'] = 'A Ugandan number as +2567XXXXXXXX.';
    if (!EMAIL.test(email)) errors['support.email'] = 'A valid email address.';
    support = { emergencyPhone: phone as UgPhone, email };
  }

  const cat = (input as { catalogue?: unknown }).catalogue;
  let catalogue: CatalogueItem[] = [...DEFAULT_CATALOGUE];
  if (cat !== undefined) {
    catalogue = [];
    if (!Array.isArray(cat)) errors['catalogue'] = 'A list of items.';
    else if (cat.length > LIMITS.catalogue.maxItems) {
      errors['catalogue'] = `At most ${LIMITS.catalogue.maxItems} items.`;
    } else {
      const seen = new Set<string>();
      cat.forEach((raw, i) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const id = typeof item.id === 'string' ? item.id : '';
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        const service = item.service as ServiceType;
        if (!CATALOGUE_ID.test(id))
          errors[`catalogue.${i}.id`] = 'Lowercase letters, digits and dashes, 2–40 characters.';
        else if (seen.has(id)) errors[`catalogue.${i}.id`] = `"${id}" is used twice.`;
        seen.add(id);
        if (!label || label.length > LIMITS.catalogue.maxLabel)
          errors[`catalogue.${i}.label`] = 'A label up to 40 characters.';
        if (!SERVICES.includes(service)) errors[`catalogue.${i}.service`] = 'Choose a fault.';
        catalogue.push({ id, label, service });
      });
    }
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
      support,
      catalogue,
    },
  };
}

/**
 * Catalogue ids are stored on jobs, so a published id must never disappear or change meaning:
 * the ids in `previous` must all still exist in `next`. Returns the ids that would be lost.
 */
export function removedCatalogueIds(
  previous: readonly CatalogueItem[],
  next: readonly CatalogueItem[],
): string[] {
  const kept = new Set(next.map((c) => c.id));
  return previous.map((c) => c.id).filter((id) => !kept.has(id));
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
  if (before.support.emergencyPhone !== after.support.emergencyPhone) {
    changes.push(
      `Emergency line: ${before.support.emergencyPhone} → ${after.support.emergencyPhone}`,
    );
  }
  if (before.support.email !== after.support.email) {
    changes.push(`Support email: ${before.support.email} → ${after.support.email}`);
  }
  const was = new Map(before.catalogue.map((c) => [c.id, c]));
  const added = after.catalogue.filter((c) => !was.has(c.id));
  const relabelled = after.catalogue.filter((c) => {
    const old = was.get(c.id);
    return old && (old.label !== c.label || old.service !== c.service);
  });
  if (added.length)
    changes.push(
      `Catalogue: ${added.length} new ${added.length === 1 ? 'item' : 'items'} (${added.map((c) => c.label).join(', ')})`,
    );
  for (const c of relabelled)
    changes.push(`Catalogue "${c.id}": ${was.get(c.id)!.label} → ${c.label}`);
  const removed = removedCatalogueIds(before.catalogue, after.catalogue);
  if (removed.length) changes.push(`Catalogue: ${removed.length} removed (${removed.join(', ')})`);
  return changes;
}

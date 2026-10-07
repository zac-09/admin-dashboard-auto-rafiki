import { SERVICE_LABELS } from '@/lib/labels';

import {
  checkAppSettings,
  DEFAULT_APP_SETTINGS,
  effectiveSettings,
  settingsChanges,
} from '../appSettings';

const valid = () => structuredClone(DEFAULT_APP_SETTINGS);

describe('settings/app contract (mirrors the app schema)', () => {
  it('accepts the app defaults (UGX 30,000 tyre … 5 km, 8 km, 90 s)', () => {
    expect(checkAppSettings(valid())).toEqual({ ok: true, settings: DEFAULT_APP_SETTINGS });
    expect(DEFAULT_APP_SETTINGS.broadcast).toEqual({
      initialRadiusKm: 5,
      expandedRadiusKm: 8,
      windowMs: 90_000,
    });
  });

  it.each([
    [
      'a missing price',
      (s: ReturnType<typeof valid>) => delete (s.prices as Record<string, number>).battery,
      'prices.battery',
    ],
    ['a zero price', (s: ReturnType<typeof valid>) => (s.prices.battery = 0), 'prices.battery'],
    [
      'a fractional price',
      (s: ReturnType<typeof valid>) => (s.prices.fuel = 25_000.5),
      'prices.fuel',
    ],
    [
      'a price over UGX 1,000,000',
      (s: ReturnType<typeof valid>) => (s.prices.towing = 1_000_001),
      'prices.towing',
    ],
    [
      'expanded below initial',
      (s: ReturnType<typeof valid>) => (s.broadcast.expandedRadiusKm = 4),
      'broadcast.expandedRadiusKm',
    ],
    [
      'a radius over 30 km',
      (s: ReturnType<typeof valid>) => (s.broadcast.expandedRadiusKm = 31),
      'broadcast.expandedRadiusKm',
    ],
    [
      'a window under 30 s',
      (s: ReturnType<typeof valid>) => (s.broadcast.windowMs = 29_999),
      'broadcast.windowMs',
    ],
    [
      'a window over 10 min',
      (s: ReturnType<typeof valid>) => (s.broadcast.windowMs = 600_001),
      'broadcast.windowMs',
    ],
  ])('rejects %s', (_, mutate, field) => {
    const s = valid();
    mutate(s);
    const result = checkAppSettings(s);
    expect(result.ok).toBe(false);
    expect(result.ok ? {} : result.errors).toHaveProperty([field]);
  });

  it('allows fractional radii, as the app does', () => {
    const s = valid();
    s.broadcast.initialRadiusKm = 4.5;
    expect(checkAppSettings(s).ok).toBe(true);
  });

  it('reads stored documents like the app: whole-document fallback when invalid', () => {
    expect(effectiveSettings(undefined).source).toBe('default');
    expect(effectiveSettings({ ...valid(), version: 2 }).source).toBe('default');
    expect(effectiveSettings({ ...valid(), prices: { battery: 1 } }).source).toBe('default');
    const stored = { ...valid(), updatedAt: '2026-10-07T09:00:00.000Z', updatedBy: 'a1' };
    expect(effectiveSettings(stored)).toEqual({ settings: stored, source: 'remote' });
  });

  it('describes changes in words', () => {
    const after = valid();
    after.prices.battery = 40_000;
    after.broadcast.windowMs = 120_000;
    expect(settingsChanges(DEFAULT_APP_SETTINGS, after, SERVICE_LABELS)).toEqual([
      'Dead battery: UGX 35,000 → UGX 40,000',
      'Broadcast window: 90 s → 120 s',
    ]);
  });
});

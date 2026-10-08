import { SERVICE_LABELS } from '@/lib/labels';

import {
  checkAppSettings,
  DEFAULT_APP_SETTINGS,
  effectiveSettings,
  removedCatalogueIds,
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

describe('support and catalogue (added 2026-10-08, optional in the document)', () => {
  it('absent sections mean the app defaults, including the placeholder emergency line', () => {
    const doc = { version: 1, prices: valid().prices, broadcast: valid().broadcast };
    const r = checkAppSettings(doc);
    expect(r.ok && r.settings.support.emergencyPhone).toBe('+256700000000');
    expect(r.ok && r.settings.catalogue.length).toBe(34);
  });

  it.each([
    [
      'a non-Ugandan emergency number',
      { emergencyPhone: '+254712345678', email: 'a@b.co' },
      'support.emergencyPhone',
    ],
    [
      'a local-format number',
      { emergencyPhone: '0772123456', email: 'a@b.co' },
      'support.emergencyPhone',
    ],
    ['a bad email', { emergencyPhone: '+256772123456', email: 'nope' }, 'support.email'],
  ])('rejects %s', (_, support, field) => {
    const r = checkAppSettings({ ...valid(), support });
    expect(r.ok).toBe(false);
    expect(r.ok ? {} : r.errors).toHaveProperty([field]);
  });

  it.each([
    [
      'an id that is not a slug',
      [{ id: 'Tyre Puncture', label: 'x', service: 'flat-tyre' }],
      'catalogue.0.id',
    ],
    [
      'a duplicate id',
      [
        { id: 'a-b', label: 'x', service: 'fuel' },
        { id: 'a-b', label: 'y', service: 'fuel' },
      ],
      'catalogue.1.id',
    ],
    ['an empty label', [{ id: 'a-b', label: '  ', service: 'fuel' }], 'catalogue.0.label'],
    [
      'a label over 40 chars',
      [{ id: 'a-b', label: 'x'.repeat(41), service: 'fuel' }],
      'catalogue.0.label',
    ],
    ['an unknown service', [{ id: 'a-b', label: 'x', service: 'painting' }], 'catalogue.0.service'],
  ])('rejects %s', (_, catalogue, field) => {
    const r = checkAppSettings({ ...valid(), catalogue });
    expect(r.ok).toBe(false);
    expect(r.ok ? {} : r.errors).toHaveProperty([field]);
  });

  it('rejects more than 200 items', () => {
    const catalogue = Array.from({ length: 201 }, (_, i) => ({
      id: `item-${i}`,
      label: 'x',
      service: 'other',
    }));
    expect(checkAppSettings({ ...valid(), catalogue }).ok).toBe(false);
  });

  it('names catalogue ids a publish would lose', () => {
    const next = DEFAULT_APP_SETTINGS.catalogue.filter((c) => c.id !== 'tyre-valve');
    expect(removedCatalogueIds(DEFAULT_APP_SETTINGS.catalogue, next)).toEqual(['tyre-valve']);
    expect(
      removedCatalogueIds(DEFAULT_APP_SETTINGS.catalogue, DEFAULT_APP_SETTINGS.catalogue),
    ).toEqual([]);
  });

  it('describes support and catalogue changes in words', () => {
    const after = valid();
    after.support = { emergencyPhone: '+256772000111', email: 'help@autorafiki.app' };
    after.catalogue = [
      ...after.catalogue,
      { id: 'tyre-rim', label: 'Rim repair', service: 'flat-tyre' },
    ];
    after.catalogue[0] = { ...after.catalogue[0]!, label: 'Puncture fix' };
    expect(settingsChanges(DEFAULT_APP_SETTINGS, after, SERVICE_LABELS)).toEqual([
      'Emergency line: +256700000000 → +256772000111',
      'Support email: support@autorafiki.app → help@autorafiki.app',
      'Catalogue: 1 new item (Rim repair)',
      'Catalogue "tyre-puncture": Puncture repair → Puncture fix',
    ]);
  });
});

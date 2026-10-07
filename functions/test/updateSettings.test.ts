import { DEFAULT_APP_SETTINGS } from '../../src/lib/appSettings';
import type { AuditEntry } from '../../src/types/audit';
import type { AppSettings } from '../../src/types/domain';
import type { Caller } from '../src/setUserRole';
import { updateSettings, type SettingsDeps } from '../src/updateSettings';

const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };

function world(stored: unknown = null) {
  const state = { doc: stored as AppSettings | null };
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: SettingsDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      await run({
        get: async () => structuredClone(state.doc),
        set: (s) => writes.push(() => (state.doc = s)),
        audit: (e) => writes.push(() => audit.push(e)),
      });
      writes.forEach((w) => w());
    },
    now: () => new Date('2026-10-07T09:00:00.000Z'),
  };
  return { deps, state, audit };
}

const withBattery = (price: number) => {
  const s = structuredClone(DEFAULT_APP_SETTINGS);
  s.prices.battery = price;
  return s;
};

describe('updateSettings', () => {
  it('first publish of the current values creates settings/app, audited', async () => {
    const w = world();
    const result = await updateSettings(
      ADMIN,
      { settings: DEFAULT_APP_SETTINGS, reason: 'Go live' },
      w.deps,
    );
    expect(result.changes).toEqual([]);
    expect(w.state.doc).toEqual({
      ...DEFAULT_APP_SETTINGS,
      updatedAt: '2026-10-07T09:00:00.000Z',
      updatedBy: 'a1',
    });
    expect(w.audit[0]).toMatchObject({
      action: 'settings.update',
      targetType: 'settings',
      targetLabel: 'First publish of the current values',
      before: null,
      reason: 'Go live',
    });
  });

  it('publishes a change and records before and after', async () => {
    const w = world({ ...DEFAULT_APP_SETTINGS, updatedAt: 'x', updatedBy: 'y' });
    const result = await updateSettings(
      ADMIN,
      { settings: withBattery(40_000), reason: 'Battery costs rose' },
      w.deps,
    );
    expect(result.changes).toEqual(['Dead battery: UGX 35,000 → UGX 40,000']);
    expect(w.state.doc?.prices.battery).toBe(40_000);
    expect(JSON.parse(w.audit[0]!.before!).prices.battery).toBe(35_000);
    expect(JSON.parse(w.audit[0]!.after!).prices.battery).toBe(40_000);
  });

  it('refuses a publish that changes nothing', async () => {
    const w = world({ ...DEFAULT_APP_SETTINGS });
    await expect(
      updateSettings(ADMIN, { settings: DEFAULT_APP_SETTINGS, reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(w.audit).toHaveLength(0);
  });

  it('refuses values the app would reject, naming the field', async () => {
    const w = world();
    const bad = structuredClone(DEFAULT_APP_SETTINGS);
    bad.broadcast.expandedRadiusKm = 3;
    await expect(
      updateSettings(ADMIN, { settings: bad, reason: 'x' }, w.deps),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringMatching(/broadcast\.expandedRadiusKm/),
    });
    await expect(
      updateSettings(ADMIN, { settings: withBattery(500), reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      updateSettings(ADMIN, { settings: withBattery(40_000), reason: ' ' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(w.state.doc).toBeNull();
  });

  it('only admins publish settings', async () => {
    const w = world();
    for (const role of ['ops', 'support', undefined]) {
      await expect(
        updateSettings({ ...ADMIN, role }, { settings: withBattery(40_000), reason: 'x' }, w.deps),
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }
    await expect(updateSettings(null, {}, w.deps)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});

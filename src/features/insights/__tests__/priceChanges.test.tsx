import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS } from '@/lib/mocks/contractFixtures';
import type { MockVettingStore } from '@/lib/mocks/mockVettingRepositories';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { AuditEntry, Job } from '@/types';

import { settingsChanges } from '../priceChanges';

const snapshot = (battery: number, initialRadiusKm = 5) =>
  JSON.stringify({
    prices: { 'flat-tyre': 30000, battery },
    broadcast: { initialRadiusKm, expandedRadiusKm: 8, windowMs: 90000 },
  });
const published = (id: string, at: string, before: string | null, after: string): AuditEntry => ({
  id,
  action: 'settings.update',
  actorUid: 'staff-admin',
  actorEmail: 'admin@autorafiki.test',
  actorRole: 'admin',
  targetType: 'settings',
  targetId: 'app',
  targetLabel: 'Dead battery UGX 35,000 → UGX 40,000',
  before,
  after,
  reason: 'Parts cost more',
  at,
});
const request = (id: string, at: string, service: Job['request']['service']): Job => {
  const j = structuredClone(JOBS.find((x) => x.id === 'job_complete')!);
  return { ...j, id, request: { ...j.request, id, service, createdAt: at } };
};

describe('settings changes', () => {
  const now = new Date('2026-10-20T00:00:00Z');

  it('compares the days either side, cut short by the next change and by today', () => {
    const changes = settingsChanges(
      [
        published('c1', '2026-10-01T00:00:00Z', snapshot(35000), snapshot(40000)),
        published('c2', '2026-10-11T00:00:00Z', snapshot(40000), snapshot(40000, 6)),
      ],
      [
        request('b1', '2026-09-25T00:00:00Z', 'battery'),
        request('b2', '2026-09-28T00:00:00Z', 'battery'),
        request('a1', '2026-10-05T00:00:00Z', 'battery'),
        request('t1', '2026-10-05T00:00:00Z', 'flat-tyre'),
      ],
      now,
    );
    expect(changes.map((c) => c.entry.id)).toEqual(['c2', 'c1']);
    const [c2, c1] = changes;
    expect(c1!.before.days).toBe(14);
    expect(c1!.after.days).toBe(10); // the next change came after 10 days
    expect(c1!.services).toEqual([
      {
        service: 'battery',
        label: 'Dead battery',
        priceBefore: 35000,
        priceAfter: 40000,
        perDayBefore: 2 / 14,
        perDayAfter: 1 / 10,
      },
    ]);
    expect(c1!.after.requests).toBe(2);
    expect(c2!.before.days).toBe(10); // back to the previous change
    expect(c2!.after.days).toBe(9); // up to today
    expect(c2!.services).toEqual([]);
    expect(c2!.broadcastNotes).toEqual(['First radius 5 → 6 km']);
  });

  it('a first publish has no previous prices', () => {
    const [c] = settingsChanges(
      [published('c', '2026-10-10T00:00:00Z', null, snapshot(40000))],
      [],
      now,
    );
    expect(c!.services.map((s) => [s.service, s.priceBefore])).toEqual([
      ['flat-tyre', null],
      ['battery', null],
    ]);
  });
});

describe('settings changes tab', () => {
  it('shows each change with before and after', async () => {
    const store = new MockOperationsStore(new Date(), { history: true });
    const repos = createMockRepositories(store);
    // The audit lives in the vetting store the repositories share.
    const audit = (repos.audit as unknown as { store: MockVettingStore }).store.audit;
    audit.push(
      published(
        'c_mock',
        new Date(Date.now() - 10 * 86_400_000).toISOString(),
        snapshot(35000),
        snapshot(40000),
      ),
    );
    await repos.auth.signIn('admin@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/insights?view=changes');
    userEvent.setup();
    const section = await screen.findByRole('region', { name: /^Change of / });
    expect(section).toHaveTextContent('Dead battery UGX 35,000 → UGX 40,000');
    const rows = within(section).getAllByRole('row');
    expect(rows[0]).toHaveTextContent(/Before \(14 days\)After \(10 days\)/);
    expect(section).toHaveTextContent(/Dead battery requests a day \(UGX 35,000 → UGX 40,000\)/);
  });
});

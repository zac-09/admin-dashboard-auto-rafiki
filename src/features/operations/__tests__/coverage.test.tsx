import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { FIXTURE_NOW, JOBS, MECHANICS, RATINGS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { Job } from '@/types';

import { computeAlerts, nearestOnlineKm } from '../alerts';

const active = JOBS.filter((j) => !['complete', 'cancelled'].includes(j.status));
const online = MECHANICS.filter((m) => m.isOnline);
const MUKONO = { latitude: 0.3533, longitude: 32.7553, label: 'Mukono, Jinja Road' };

describe('nobody online nearby', () => {
  it('a request inside someone’s radius raises nothing new', () => {
    const alerts = computeAlerts(active, RATINGS, FIXTURE_NOW, { online, radiusKm: 5 });
    expect(alerts.map((a) => a.key)).toEqual([
      'stale-request:job_req_stale',
      'late-enroute:job_enroute_late',
      'low-rating:rating_m2c',
    ]);
  });

  it('with nobody online, the open request is out of reach, in place of the stale alert', () => {
    const alerts = computeAlerts(active, RATINGS, FIXTURE_NOW, { online: [], radiusKm: 5 });
    expect(alerts[0]).toMatchObject({ kind: 'out-of-reach', nearestKm: null, radiusKm: 5 });
    expect(alerts.map((a) => a.key)).not.toContain('stale-request:job_req_stale');
  });

  it('a smaller radius leaves Ntinda out of reach and says how far the nearest is', () => {
    const [first] = computeAlerts(active, [], FIXTURE_NOW, { online, radiusKm: 2 });
    expect(first).toMatchObject({ kind: 'out-of-reach', key: 'out-of-reach:job_req_stale' });
    const stale = active.find((j) => j.id === 'job_req_stale')!;
    expect(nearestOnlineKm(stale, online)).toBeCloseTo((first as { nearestKm: number }).nearestKm);
  });

  it('online but unverified mechanics do not count', () => {
    const pendingOnline = MECHANICS.filter((m) => m.vetting === 'pending').map((m) => ({
      ...m,
      isOnline: true,
    }));
    const stale = active.find((j) => j.id === 'job_req_stale')!;
    expect(nearestOnlineKm(stale, pendingOnline)).toBeNull();
  });
});

describe('out-of-reach alert in the control room', () => {
  it('fires at once for a request nobody online can reach, and leads to a message near it', async () => {
    const store = new MockOperationsStore();
    const repos = createMockRepositories(store);
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/operations');
    const user = userEvent.setup();
    const rail = await screen.findByRole('region', { name: 'Alerts' });

    const at = new Date().toISOString();
    const base = JOBS.find((j) => j.id === 'job_req_stale')!;
    const job: Job = {
      ...base,
      id: 'job_mukono',
      request: { ...base.request, id: 'job_mukono', createdAt: at, location: MUKONO },
      timeline: [{ status: 'requested', at }],
    };
    act(() => store.putJob(job));

    const item = (await within(rail).findByText('No mechanic online within 5 km')).closest('li')!;
    expect(item).toHaveTextContent(/Mukono, Jinja Road · nearest \d+\.\d km away/);
    await user.click(within(item).getByRole('link', { name: 'Message mechanics near here' }));
    const area = await screen.findByRole('combobox', { name: 'Area' });
    expect(area).toHaveDisplayValue('Near this request: Mukono, Jinja Road');
  });
});

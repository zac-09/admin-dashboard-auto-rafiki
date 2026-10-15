import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS, MECHANICS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { AuditEntry, AvailabilityRecord, Job, MechanicDoc } from '@/types';

import { medianDaysToFirstJob, recentRecruits } from '../recruits';

const now = new Date('2026-10-20T09:00:00Z');
const verified = (id: string): MechanicDoc => ({
  ...MECHANICS[0]!,
  userId: id,
  businessName: id,
  vetting: 'verified',
});
const approve = (id: string, at: string, before = 'pending'): AuditEntry => ({
  id: `${id}-${at}`,
  action: 'mechanic.vetting.approve',
  actorUid: 's',
  actorEmail: null,
  actorRole: 'ops',
  targetType: 'mechanic',
  targetId: id,
  targetLabel: id,
  before,
  after: 'verified',
  reason: 'r',
  at,
});
const completed = (id: string, mechanicId: string, at: string): Job => ({
  ...structuredClone(JOBS.find((j) => j.id === 'job_complete')!),
  id,
  mechanicId,
  timeline: [
    { status: 'requested', at },
    { status: 'complete', at },
  ],
});
const online = (mechanicId: string, at: string): AvailabilityRecord => ({
  mechanicId,
  event: 'online',
  at,
  location: { latitude: 0.3, longitude: 32.6 },
});

describe('after approval', () => {
  it('stages each recent recruit, judging "never online" only when the log covers them', () => {
    const recruits = recentRecruits(
      ['done', 'idle', 'ghost', 'early', 'old'].map(verified),
      [
        approve('done', '2026-10-10T09:00:00Z'),
        approve('idle', '2026-10-15T09:00:00Z'),
        approve('ghost', '2026-10-16T09:00:00Z'),
        approve('early', '2026-10-01T09:00:00Z'), // before the log began
        approve('old', '2026-07-01T09:00:00Z'), // outside 60 days
        approve('done', '2026-10-18T09:00:00Z', 'suspended'), // a reinstatement is not first
      ],
      [completed('j1', 'done', '2026-10-13T09:00:00Z')],
      [online('idle', '2026-10-16T08:00:00Z'), online('x', '2026-10-14T09:00:00Z')],
      now,
    );
    expect(recruits.map((r) => [r.mechanic.userId, r.stage])).toEqual([
      ['ghost', 'never-online'],
      ['idle', 'online-no-job'],
      ['done', 'first-job-done'],
      ['early', 'unknown'],
    ]);
    expect(recruits.find((r) => r.mechanic.userId === 'done')!.daysToFirstJob).toBe(3);
    expect(medianDaysToFirstJob(recruits)).toBe(3);
  });
});

describe('after approval on the Verified tab', () => {
  it('shows recent recruits and how far they got', async () => {
    const repos = createMockRepositories(new MockOperationsStore(new Date(), { history: true }));
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/vetting?queue=verified');
    userEvent.setup();
    const panel = await screen.findByRole('region', { name: 'After approval' });
    expect(panel).toHaveTextContent(/1 of 1 have done a first job · median \d+ days? to get there/);
    const done = within(panel).getByRole('list', { name: 'First job done' });
    expect(done).toHaveTextContent(/Namukasa Motors.*First job .*after approval/);
  });
});

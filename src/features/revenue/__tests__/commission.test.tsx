import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS, MECHANICS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { Job } from '@/types';

import { breakEvenJobsPerWeek, commissionModel, fullWeeks } from '../commission';

const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;
const namukasa = MECHANICS.find((m) => m.userId === 'u_mech_namukasa')!;
const completed = (id: string, mechanicId: string, at: string, fee: number): Job => ({
  ...structuredClone(JOBS.find((j) => j.id === 'job_complete')!),
  id,
  mechanicId,
  fee,
  timeline: [
    { status: 'requested', at },
    { status: 'complete', at },
  ],
});

describe('commission model', () => {
  it('full weeks exclude the running one', () => {
    expect(fullWeeks(2, new Date('2026-10-14T09:00:00Z'))).toEqual(['2026-09-28', '2026-10-05']);
  });

  it('compares commission on completed fees with the flat fee, per week and per mechanic', () => {
    // Both verified throughout (no decisions on record for Okello; Namukasa approved in August).
    const jobs = [
      completed('a', 'u_mech_okello', '2026-10-06T09:00:00Z', 30_000),
      completed('b', 'u_mech_okello', '2026-10-07T09:00:00Z', 50_000),
      completed('c', 'u_mech_namukasa', '2026-10-08T09:00:00Z', 20_000),
      completed('outside', 'u_mech_okello', '2026-10-13T09:00:00Z', 80_000),
    ];
    const m = commissionModel(['2026-10-05'], jobs, [okello, namukasa], [], 0.1);
    expect(m.weeks).toEqual([
      {
        weekStart: '2026-10-05',
        completed: 3,
        fees: 100_000,
        commission: 10_000,
        subscriptions: 30_000,
      },
    ]);
    expect(m.breakEvenRate).toBeCloseTo(0.3);
    expect(m.mechanics.map((c) => [c.mechanic.businessName, c.commission, c.difference])).toEqual([
      ['Okello Auto Rescue', 8_000, -7_000],
      ['Namukasa Motors', 2_000, -13_000],
    ]);
  });

  it('break-even jobs: UGX 15,000 ÷ (average fee × rate)', () => {
    expect(breakEvenJobsPerWeek(30_000, 0.1)).toBe(5);
    expect(breakEvenJobsPerWeek(0, 0.1)).toBeNull();
  });
});

describe('Phase 2 model tab', () => {
  it('shows commission against subscriptions and follows the chosen rate', async () => {
    const repos = createMockRepositories(new MockOperationsStore(new Date(), { history: true }));
    await repos.auth.signIn('admin@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/revenue?view=phase2');
    const user = userEvent.setup();
    expect(await screen.findByRole('region', { name: 'Commission at 10%' })).toHaveTextContent(
      /UGX [\d,]+ a week on \d+ completed jobs/,
    );
    expect(screen.getByRole('region', { name: 'Break-even rate' })).toHaveTextContent(
      /\d+(\.\d)?%/,
    );
    const weeks = screen.getByRole('region', { name: 'Week by week' });
    expect(within(weeks).getAllByRole('row')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: '20%' }));
    expect(screen.getByRole('region', { name: 'Commission at 20%' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Last 8 weeks' }));
    expect(
      within(screen.getByRole('region', { name: 'Week by week' })).getAllByRole('row'),
    ).toHaveLength(9);
    expect(
      within(screen.getByRole('region', { name: 'By mechanic' })).getAllByText(/^Pays /).length,
    ).toBeGreaterThan(0);
  });
});

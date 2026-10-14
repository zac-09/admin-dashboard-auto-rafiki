import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { AUDIT_ENTRIES } from '@/lib/mocks/auditFixtures';
import { MECHANICS } from '@/lib/mocks/contractFixtures';
import { generateHistory } from '@/lib/mocks/historyFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { addWeeks, weekLabel, weekStartOf } from '@/lib/subscriptions';
import { renderApp } from '@/test/renderApp';

import { change, weeklyReport } from '../report';

describe('weekly report', () => {
  const now = new Date('2026-10-14T09:00:00Z');
  const { jobs, ratings } = generateHistory(now);
  const data = { jobs, ratings, mechanics: MECHANICS, entries: AUDIT_ENTRIES, payments: [], now };

  it('compares the week with the one before and carries six weeks of trend', () => {
    const r = weeklyReport('2026-10-05', data);
    expect(r.week.weekStart).toBe('2026-10-05');
    expect(r.previous.weekStart).toBe('2026-09-28');
    expect(r.trend.map((t) => t.weekStart)).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ]);
    expect(r.week.requests).toBeGreaterThan(0);
    expect(r.week.acceptanceRate).toBeGreaterThan(0.5);
    expect(r.top.length).toBeGreaterThan(0);
    expect(r.gaps[0]!.unserved).toBeGreaterThan(0);
  });

  it('nothing after the week counts: scorecards stand as at its end', () => {
    const r = weeklyReport('2026-09-28', data);
    for (const s of [...r.top, ...r.concerns]) {
      expect(s.weekly.at(-1)!.weekStart).toBe('2026-09-28');
    }
  });

  it('describes change in words', () => {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    expect(change(0.2, 0.3, pct)).toBe('down from 30%');
    expect(change(0.3, 0.3, pct)).toBe('same as the week before');
    expect(change(null, 0.3, pct)).toBe('no comparison');
  });
});

describe('weekly report page', () => {
  it('opens on the last full week, steps between weeks and offers print', async () => {
    const repos = createMockRepositories(new MockOperationsStore(new Date(), { history: true }));
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/insights');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'Weekly pilot report' }));
    const lastFull = addWeeks(weekStartOf(new Date()), -1);
    expect(
      await screen.findByRole('heading', { level: 1, name: weekLabel(lastFull) }),
    ).toBeInTheDocument();
    const numbers = screen.getByRole('region', { name: 'The numbers' });
    expect(within(numbers).getByText('Jobs per mechanic')).toBeInTheDocument();
    expect(numbers).toHaveTextContent(/(up|down) from|same as the week before/);
    expect(
      within(screen.getByRole('region', { name: 'Six-week trend' })).getAllByRole('row'),
    ).toHaveLength(7);

    window.print = vi.fn();
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(window.print).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: weekLabel(addWeeks(lastFull, -1)) }),
    ).toBeInTheDocument();
  });
});

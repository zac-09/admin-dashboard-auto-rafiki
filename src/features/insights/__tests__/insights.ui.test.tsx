import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support', path: string, history = true) {
  const repos = createMockRepositories(new MockOperationsStore(new Date(), { history }));
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

describe('insights', () => {
  it('trends: four week-by-week charts, each readable as numbers', async () => {
    const user = await openAs('ops', '/insights');
    for (const name of [
      'Jobs per mechanic per week',
      'Request to arrival (median)',
      'Subscriptions collected',
      'Requests nobody took',
    ]) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument();
    }
    const main = screen.getByRole('region', { name: 'Jobs per mechanic per week' });
    expect(within(main).getByRole('img')).toHaveAccessibleName(/^Jobs per mechanic: \d+\.\d/);
    expect(main).toHaveTextContent(/Last full week: \d+\.\d, against \d+\.\d four weeks earlier/);
    await user.click(within(main).getByText('Show the numbers'));
    expect(within(main).getAllByRole('row')).toHaveLength(11);
  });

  it('coverage: the worst areas first, with the nearest mechanic', async () => {
    const user = await openAs('ops', '/insights');
    await user.click(await screen.findByRole('button', { name: 'Coverage gaps' }));
    const list = await screen.findByRole('list', { name: 'Unserved areas, worst first' });
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent(
      /^1\..+\d+ of \d+ unanswered \(\d+%\)Nearest verified mechanic/,
    );
    // Without a Maps key the map says so; the list carries the same areas.
    expect(await screen.findByText(/The map needs VITE_MAPS_API_KEY/)).toBeInTheDocument();
  });

  it('demand: a weekday-by-hour grid and the hours that most need mechanics', async () => {
    const user = await openAs('ops', '/insights?view=demand');
    const hardest = await screen.findByRole('region', { name: 'Hardest hours' });
    expect(within(hardest).getAllByRole('listitem')[0]).toHaveTextContent(
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d:00–\d\d:00\d+ of \d+ requests unanswered$/,
    );
    const table = screen.getByRole('table', { name: 'Requests by weekday and hour' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Unanswered' }));
    expect(
      screen.getByRole('table', { name: 'Unanswered requests by weekday and hour' }),
    ).toBeInTheDocument();
  });

  it('scorecards: a ranked table with signals; sorting by concerns', async () => {
    const user = await openAs('admin', '/insights?view=mechanics');
    const table = await screen.findByRole('table', { name: 'Mechanic scorecards' });
    const rows = () => within(table).getAllByRole('row').slice(1);
    expect(rows().map((r) => within(r).getAllByRole('link')[0]!.textContent)).toEqual(
      expect.arrayContaining(['Okello Auto Rescue', 'Namukasa Motors', 'Waiswa Heavy Recovery']),
    );
    const okello = rows().find((r) => /Okello/.test(r.textContent ?? ''))!;
    expect(okello).toHaveTextContent(/\d+ h a week/);
    expect(okello).toHaveTextContent(/\d+% taken\d+ of \d+ taken/);
    const waiswa = rows().find((r) => /Waiswa/.test(r.textContent ?? ''))!;
    expect(waiswa).toHaveTextContent('Cancels often');
    await user.click(screen.getByRole('button', { name: 'Most concerns' }));
    expect(screen.getByRole('button', { name: 'Most concerns' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(rows()[0]).not.toHaveTextContent(/Signals–$/);
  });

  it('support has no insights', async () => {
    await openAs('support', '/insights');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
  });
});

describe('performance on the mechanic page', () => {
  it('shows the scorecard with payments for ops', async () => {
    await openAs('ops', '/vetting/u_mech_okello', false);
    const panel = await screen.findByRole('region', { name: 'Performance' });
    expect(await within(panel).findByText('Jobs per week (last 4)')).toBeInTheDocument();
    expect(
      within(panel).getByRole('list', { name: 'Completed jobs per week' }),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Subscription')).toBeInTheDocument();
  });

  it('support sees performance but not payments', async () => {
    await openAs('support', '/vetting/u_mech_okello', false);
    const panel = await screen.findByRole('region', { name: 'Performance' });
    expect(await within(panel).findByText('Jobs per week (last 4)')).toBeInTheDocument();
    expect(within(panel).queryByText('Subscription')).not.toBeInTheDocument();
  });

  it('a pending applicant with no jobs has no performance panel', async () => {
    await openAs('ops', '/vetting/u_mech_kato', false);
    await screen.findByRole('region', { name: 'Profile' });
    expect(screen.queryByRole('region', { name: 'Performance' })).not.toBeInTheDocument();
  });
});

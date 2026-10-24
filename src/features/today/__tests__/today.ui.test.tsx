import { screen, within } from '@testing-library/react';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { greeting } from '../greeting';

async function openAs(role: 'admin' | 'ops' | 'support', path = '/') {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
}

describe('Today', () => {
  it('is where everyone lands, with what needs them across their modules', async () => {
    await openAs('admin');
    expect(
      await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening)/ }),
    ).toBeInTheDocument();
    for (const name of [
      'Open alerts',
      'Applicants waiting',
      'Open disputes',
      'Mechanics overdue',
    ]) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument();
    }
    const alerts = screen.getByRole('region', { name: 'Open alerts' });
    expect(within(alerts).getByRole('link', { name: 'Open the control room' })).toHaveAttribute(
      'href',
      '/operations',
    );
    // The mock data has a stale request: it leads the urgent list and links to its job.
    const urgent = await screen.findByRole('list', { name: 'Most urgent alerts' });
    expect(within(urgent).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/jobs\//),
    );
    expect(screen.getByRole('region', { name: 'Right now' })).toHaveTextContent(
      /Mechanics online\d+/,
    );
    expect(await screen.findByRole('region', { name: 'Last 24 hours' })).toHaveTextContent(
      /Requests\d+/,
    );
    expect(screen.getByRole('region', { name: 'Shift handover' })).toBeInTheDocument();
  });

  it('support sees no money: no overdue card and no KPIs', async () => {
    await openAs('support', '/today');
    expect(await screen.findByRole('region', { name: 'Open disputes' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Mechanics overdue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Last 24 hours' })).not.toBeInTheDocument();
  });

  it('greets by the hour in Kampala (UTC+3)', () => {
    expect(greeting(new Date('2026-10-24T05:00:00Z'))).toBe('Good morning');
    expect(greeting(new Date('2026-10-24T10:00:00Z'))).toBe('Good afternoon');
    expect(greeting(new Date('2026-10-24T15:00:00Z'))).toBe('Good evening');
  });
});

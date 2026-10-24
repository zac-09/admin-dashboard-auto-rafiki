import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { readPreference, writePreference } from '../preferences';

async function open(path: string) {
  const repos = createMockRepositories(new MockOperationsStore(new Date(), { history: true }));
  await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  return renderApp(path);
}

describe('remembered choices', () => {
  it('reads back what was written, and falls back on anything unknown or broken', () => {
    writePreference('kpis.window', '30');
    expect(readPreference('kpis.window', '7')).toBe('30');
    const isWindow = (v: unknown): v is '7' | '30' => v === '7' || v === '30';
    writePreference('kpis.window', 'yearly');
    expect(readPreference('kpis.window', '7', isWindow)).toBe('7');
    localStorage.setItem('autorafiki.pref.broken', '{not json');
    expect(readPreference('broken', 'fallback')).toBe('fallback');
  });

  it('reopening Insights brings back the last tab; a link naming a tab still wins', async () => {
    const user = userEvent.setup();
    const first = await open('/insights');
    await user.click(await screen.findByRole('button', { name: 'Funnel & mix' }));
    expect(
      await screen.findByRole('list', { name: 'Requests reaching each step' }),
    ).toBeInTheDocument();
    first.unmount();

    const second = await open('/insights');
    expect(
      await screen.findByRole('list', { name: 'Requests reaching each step' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Funnel & mix' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    second.unmount();

    await open('/insights?view=demand');
    expect(await screen.findByRole('region', { name: 'Hardest hours' })).toBeInTheDocument();
  });

  it('the KPI window is remembered', async () => {
    const user = userEvent.setup();
    const first = await open('/revenue?view=kpis');
    await user.click(await screen.findByRole('button', { name: 'Last 30 days' }));
    first.unmount();
    await open('/revenue?view=kpis');
    expect(await screen.findByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

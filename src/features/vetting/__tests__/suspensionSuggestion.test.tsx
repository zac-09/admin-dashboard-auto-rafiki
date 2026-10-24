import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  overdueAccounts,
  suspensionReason,
  suspensionSuggested,
} from '@/features/revenue/collections';
import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { MECHANICS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

// Thursday 15 Oct 2026, noon Kampala: weeks of 5 and 12 Oct are both overdue for anyone unpaid.
const THURSDAY = new Date('2026-10-15T09:00:00Z');
const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;

afterEach(() => vi.useRealTimers());

describe('the unpaid-weeks rule', () => {
  it('suggests suspension at 2 overdue weeks, with a reason ops can edit', () => {
    const [account] = overdueAccounts([okello], [], [], THURSDAY);
    expect(account!.weeks).toEqual(['2026-10-05', '2026-10-12']);
    expect(suspensionSuggested(account!)).toBe(true);
    expect(suspensionSuggested({ weeks: ['2026-10-05'] })).toBe(false);
    expect(suspensionReason(account!)).toBe(
      'Subscription unpaid for 2 weeks (5–11 Oct 2026; 12–18 Oct 2026), UGX 30,000 outstanding. Reinstate once paid.',
    );
  });
});

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  vi.useFakeTimers({ now: THURSDAY, toFake: ['Date'] });
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

describe('suspension suggested', () => {
  it('flags the mechanic in To collect and prefills (never saves) the suspension', async () => {
    const user = await openAs('ops', '/revenue');
    const panel = await screen.findByRole('region', { name: 'Overdue payments' });
    const okelloRow = (
      await within(
        await within(panel).findByRole('list', { name: 'Mechanics to remind' }),
      ).findAllByRole('listitem')
    ).find((li) => /Okello/.test(li.textContent ?? ''))!;
    await user.click(within(okelloRow).getByRole('link', { name: /Suspension suggested: review/ }));

    const suggestion = await screen.findByRole('region', { name: 'Suspension suggested' });
    expect(suggestion).toHaveTextContent('2 weeks of subscription unpaid (UGX 30,000)');
    await user.click(within(suggestion).getByRole('button', { name: 'Prefill suspension' }));
    expect(screen.getByRole('radio', { name: /Suspend/ })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveValue(
      'Subscription unpaid for 2 weeks (5–11 Oct 2026; 12–18 Oct 2026), UGX 30,000 outstanding. Reinstate once paid.',
    );
    // Nothing happened yet: still verified until ops save.
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveTextContent('Verified');
  });

  it('support sees no suggestion (no revenue access)', async () => {
    await openAs('support', '/vetting/u_mech_okello');
    await screen.findByRole('region', { name: 'Profile' });
    expect(screen.queryByRole('region', { name: 'Suspension suggested' })).not.toBeInTheDocument();
  });
});

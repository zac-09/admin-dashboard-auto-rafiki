import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

const row = (text: RegExp) =>
  within(screen.getByRole('list', { name: 'Staff' }))
    .getAllByRole('listitem')
    .find((li) => text.test(li.textContent ?? ''))!;

describe('staff & roles', () => {
  it('lists staff by role with sign-in status; admins cannot change their own role', async () => {
    await openAs('admin', '/staff');
    const list = await screen.findByRole('list', { name: 'Staff' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringMatching(/^Amina Admin · you.*Admin.*Last signed in/),
      expect.stringMatching(/^Okello Ops.*Operations/),
      expect.stringMatching(/^Sarah Support.*Support/),
      expect.stringMatching(/^Nakato Customer.*No access.*Never signed in.*Give access/),
    ]);
    expect(within(row(/Amina Admin/)).queryByRole('button')).not.toBeInTheDocument();
  });

  it('invites someone and hands over a single-use setup link', async () => {
    const user = await openAs('admin', '/staff');
    await user.click(await screen.findByRole('button', { name: 'Invite staff' }));
    const form = screen.getByRole('form', { name: 'Invite staff' });
    expect(within(form).getByText('Enter their email')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Email'), 'grace@autorafiki.test');
    await user.type(within(form).getByLabelText('Name (optional)'), 'Grace Achieng');
    await user.click(within(form).getByRole('radio', { name: /Support/ }));
    await user.type(within(form).getByLabelText(/Reason/), 'Second support agent');
    await user.click(within(form).getByRole('button', { name: 'Invite' }));
    expect(await screen.findByText(/has an account now/)).toBeInTheDocument();
    expect(screen.getByText(/mode=resetPassword/)).toBeInTheDocument();
    expect(
      await within(screen.getByRole('list', { name: 'Staff' })).findByText('Grace Achieng'),
    ).toBeInTheDocument();
  });

  it('changes a role with a reason, and can remove access', async () => {
    const user = await openAs('admin', '/staff');
    await screen.findByRole('list', { name: 'Staff' });
    await user.click(within(row(/Sarah Support/)).getByRole('button', { name: 'Change role' }));
    const form = screen.getByRole('form', { name: 'Change role for support@autorafiki.test' });
    expect(within(form).getByText('Choose a different role')).toBeInTheDocument();
    await user.click(within(form).getByRole('radio', { name: /Operations/ }));
    await user.type(within(form).getByLabelText(/Reason/), 'Promoted');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Role updated')).toBeInTheDocument();
    expect(await screen.findByText(/^Sarah Support/)).toBeInTheDocument();
    expect(row(/Sarah Support/)).toHaveTextContent('Operations');

    await user.click(within(row(/Okello Ops/)).getByRole('button', { name: 'Change role' }));
    const remove = screen.getByRole('form', { name: 'Change role for ops@autorafiki.test' });
    await user.click(within(remove).getByRole('radio', { name: /Remove dashboard access/ }));
    await user.type(within(remove).getByLabelText(/Reason/), 'Left the company');
    await user.click(within(remove).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Access removed')).toBeInTheDocument();
  });

  it.each(['ops', 'support'] as const)('%s cannot open staff management', async (role) => {
    await openAs(role, '/staff');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('shows the app-compiled values read-only, and the subscription rules', async () => {
    await openAs('support', '/settings');
    expect(await screen.findByText(/Read-only for now/)).toBeInTheDocument();
    const prices = screen.getByRole('region', { name: 'Upfront prices (set in the app)' });
    expect(prices).toHaveTextContent('Dead batteryUGX 35,000');
    expect(prices).toHaveTextContent('TowingUGX 80,000');
    expect(screen.getByRole('region', { name: 'Broadcast (set in the app)' })).toHaveTextContent(
      /5 km.*8 km.*90 seconds/,
    );
    expect(screen.getByRole('region', { name: 'Subscriptions (dashboard)' })).toHaveTextContent(
      /UGX 15,000.*Monday to Sunday.*Thursday/,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('switches dark mode from settings', async () => {
    const user = await openAs('ops', '/settings');
    const toggle = await screen.findByRole('switch', { name: 'Dark mode' });
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(toggle);
  });
});

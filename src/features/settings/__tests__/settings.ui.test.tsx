import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support') {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp('/settings');
  return userEvent.setup();
}

describe('settings', () => {
  it('before anything is published, shows the app’s built-in values and says so', async () => {
    await openAs('support');
    expect(await screen.findByText(/Not published yet/)).toBeInTheDocument();
    const prices = screen.getByRole('region', { name: 'Upfront prices' });
    expect(prices).toHaveTextContent('Dead batteryUGX 35,000');
    expect(prices).toHaveTextContent('TowingUGX 80,000');
    expect(screen.getByRole('region', { name: 'Broadcast' })).toHaveTextContent(
      /5 km.*8 km.*90 seconds/,
    );
    expect(screen.getByRole('region', { name: 'Subscriptions (dashboard)' })).toHaveTextContent(
      /UGX 15,000.*Monday to Sunday.*Thursday/,
    );
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it.each(['ops', 'support'] as const)('%s cannot edit', async (role) => {
    await openAs(role);
    await screen.findByRole('region', { name: 'Upfront prices' });
    expect(
      screen.queryByRole('button', { name: 'Edit prices & broadcast' }),
    ).not.toBeInTheDocument();
  });

  it('an admin edits, sees field errors and a plain-words preview, publishes, and it goes live', async () => {
    const user = await openAs('admin');
    await user.click(await screen.findByRole('button', { name: 'Edit prices & broadcast' }));
    const form = screen.getByRole('form', { name: 'Edit settings' });

    const battery = within(form).getByLabelText('Dead battery');
    await user.clear(battery);
    await user.type(battery, '500');
    expect(
      within(form).getByText('Whole shillings from UGX 1,000 to 1,000,000.'),
    ).toBeInTheDocument();
    expect(within(form).getByText('Fix the highlighted values')).toBeInTheDocument();

    await user.clear(battery);
    await user.type(battery, '40000');
    const expanded = within(form).getByLabelText('Widened once to');
    await user.clear(expanded);
    await user.type(expanded, '12');
    const changes = within(form).getByRole('region', { name: 'Changes' });
    expect(
      within(changes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Dead battery: UGX 35,000 → UGX 40,000', 'Widened radius: 8 km → 12 km']);

    await user.type(within(form).getByLabelText(/Reason/), 'Battery prices rose; wider search');
    await user.click(within(form).getByRole('button', { name: 'Publish to the app' }));
    expect(await screen.findByText('Settings published')).toBeInTheDocument();
    expect(await screen.findByText(/Live in the app/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Upfront prices' })).toHaveTextContent(
      'Dead batteryUGX 40,000',
    );
    expect(screen.getByRole('region', { name: 'Broadcast' })).toHaveTextContent('12 km');
  });

  it('the first publish can keep the current values (it creates the shared settings)', async () => {
    const user = await openAs('admin');
    await user.click(await screen.findByRole('button', { name: 'Edit prices & broadcast' }));
    const form = screen.getByRole('form', { name: 'Edit settings' });
    expect(
      within(form).getByText(/Publishing as-is creates the shared settings/),
    ).toBeInTheDocument();
    await user.type(within(form).getByLabelText(/Reason/), 'Go live with the app values');
    await user.click(within(form).getByRole('button', { name: 'Publish to the app' }));
    expect(await screen.findByText(/Live in the app/)).toBeInTheDocument();
  });

  it('switches dark mode from settings', async () => {
    const user = await openAs('ops');
    const toggle = await screen.findByRole('switch', { name: 'Dark mode' });
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(toggle);
  });
});

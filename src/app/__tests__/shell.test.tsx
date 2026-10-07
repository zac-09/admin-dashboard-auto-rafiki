import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import { THEME_STORAGE_KEY, useThemeMode } from '@/theme/themeMode';

async function signInAs(email: string, password = MOCK_PASSWORD) {
  const user = userEvent.setup();
  renderApp('/vetting');
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

beforeEach(() => {
  setRepositoriesForTesting(createMockRepositories());
  useSessionStore.setState({ status: 'loading', session: null });
  localStorage.clear();
  useThemeMode.getState().setMode('light');
});

describe('role-gated shell', () => {
  it('sends signed-out visitors to the login page and rejects a wrong password', async () => {
    await signInAs('admin@autorafiki.test', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('an admin lands on Vetting and sees every module, including Staff', async () => {
    await signInAs('admin@autorafiki.test');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Vetting', 'Operations', 'Support', 'Revenue', 'Settings', 'Staff']);
    expect(within(nav).getByRole('link', { name: 'Vetting' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('heading', { name: 'Mechanic vetting' })).toBeInTheDocument();
  });

  it('support sees no Revenue or Staff, and is stopped at /staff', async () => {
    const user = await signInAs('support@autorafiki.test');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Revenue' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Sarah Support/ })[0]!);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument();
  });

  it('blocks a role from a route it cannot open', async () => {
    useSessionStore.setState({
      status: 'signedIn',
      session: { uid: 's', email: 'support@autorafiki.test', displayName: null, role: 'support' },
    });
    const repos = createMockRepositories();
    repos.auth.subscribe = () => () => undefined;
    setRepositoriesForTesting(repos);
    renderApp('/staff');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
  });

  it('an account without a role gets the no-access page', async () => {
    await signInAs('customer@autorafiki.test');
    expect(await screen.findByRole('heading', { name: 'No dashboard access' })).toBeInTheDocument();
  });

  it('the user menu switches to dark mode and remembers it', async () => {
    const user = await signInAs('ops@autorafiki.test');
    await user.click((await screen.findAllByRole('button', { name: /Okello Ops/ }))[0]!);
    const toggle = screen.getByRole('switch', { name: /Dark mode/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

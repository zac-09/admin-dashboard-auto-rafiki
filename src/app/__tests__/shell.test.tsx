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

  it('reset password shows it is sending, sends once, then confirms', async () => {
    const repos = createMockRepositories();
    let release!: () => void;
    const send = vi
      .spyOn(repos.auth, 'sendPasswordReset')
      .mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    setRepositoriesForTesting(repos);
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email'), 'ops@autorafiki.test');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    const busy = screen.getByRole('button', { name: 'Sending reset link…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    expect(send).toHaveBeenCalledTimes(1);
    release();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If ops@autorafiki.test has a staff account, a reset link is on its way.',
    );
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled();
  });

  it('the sidebar counts what waits in each module, in words for screen readers', async () => {
    await signInAs('admin@autorafiki.test');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      await within(nav).findByRole('link', { name: /^Vetting, \d+ applicants? waiting$/ }),
    ).toBeInTheDocument();
    expect(
      await within(nav).findByRole('link', { name: /^Operations, \d+ open alerts?$/ }),
    ).toBeInTheDocument();
    // Nothing waiting: no badge at all, not a zero.
    expect(within(nav).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('an admin lands on Vetting and sees every module, including Staff', async () => {
    await signInAs('admin@autorafiki.test');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        // The label without its count badge (labels have no digits; badges start with one).
        .map((l) => l.textContent?.replace(/\d.*$/, '')),
    ).toEqual([
      'Today',
      'Vetting',
      'Operations',
      'Messages',
      'Support',
      'Customers',
      'Revenue',
      'Insights',
      'Settings',
      'Audit log',
      'Staff',
    ]);
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

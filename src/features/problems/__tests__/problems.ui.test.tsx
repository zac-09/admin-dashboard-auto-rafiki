import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { browserName } from '../browser';

const repos = () => createMockRepositories();

async function signIn(
  r: ReturnType<typeof repos>,
  role: 'admin' | 'ops' | 'support',
  path: string,
) {
  await r.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(r);
  useSessionStore.setState({ status: 'loading', session: null });
  return renderApp(path);
}

describe('report a problem', () => {
  it('any staff member reports from any page, with the page captured; admins resolve it', async () => {
    const r = repos();
    const user = userEvent.setup();
    const { unmount } = await signIn(r, 'support', '/support');
    await user.click(await screen.findByRole('button', { name: 'Report a problem' }));
    const dialog = screen.getByRole('dialog', { name: 'Report a problem' });
    const field = within(dialog).getByRole('textbox');
    expect(field).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Send report' })).toBeDisabled();
    await user.type(field, 'Search for UBA 123X shows nothing');
    await user.click(within(dialog).getByText('Sent with it automatically'));
    expect(dialog).toHaveTextContent('support@autorafiki.test (Support)');
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Thanks, problem reported')).toBeInTheDocument();
    unmount();

    await signIn(r, 'admin', '/problems');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      await within(nav).findByRole('link', { name: 'Problem reports, 1 open report' }),
    ).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Open reports' });
    expect(list).toHaveTextContent('Search for UBA 123X shows nothing');
    expect(list).toHaveTextContent('support@autorafiki.test (Support)');
    expect(within(list).getByRole('link')).toHaveAttribute('href', '/support');
    await user.click(within(list).getByRole('button', { name: /^Mark resolved/ }));
    expect(await screen.findByText('No open reports.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Resolved/ }));
    expect(await screen.findByRole('list', { name: 'Resolved reports' })).toHaveTextContent(
      /Resolved.+by admin@autorafiki.test/,
    );
  });

  it('only admins see the reports page', async () => {
    await signIn(repos(), 'ops', '/problems');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', {
        name: /^Problem reports/,
      }),
    ).not.toBeInTheDocument();
  });

  it('names the browser plainly', () => {
    expect(
      browserName(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 141 on macOS');
    expect(
      browserName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 18 on iOS');
    expect(browserName('curl/8')).toBe('curl/8');
  });
});

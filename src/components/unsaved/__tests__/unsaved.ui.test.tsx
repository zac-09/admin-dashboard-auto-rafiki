import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { useUnsavedStore } from '../unsavedStore';

async function openJob() {
  const repos = createMockRepositories();
  await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp('/jobs/job_complete');
  const user = userEvent.setup();
  const form = await screen.findByRole('form', { name: 'Add a note' });
  return { user, form };
}

const nav = () => screen.getByRole('navigation', { name: 'Main' });

describe('unsaved work', () => {
  it('asks before leaving a page with a typed note; Stay keeps it, Leave discards it', async () => {
    const { user, form } = await openJob();
    await user.type(within(form).getByRole('textbox'), 'Customer called twice about the bill');
    await user.click(within(nav()).getByRole('link', { name: /^Revenue/ }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    expect(within(dialog).getByRole('button', { name: 'Stay on this page' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Stay on this page' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(within(form).getByRole('textbox')).toHaveValue('Customer called twice about the bill');

    await user.click(within(nav()).getByRole('link', { name: /^Revenue/ }));
    await user.click(await screen.findByRole('button', { name: 'Leave and discard' }));
    expect(await screen.findByRole('heading', { name: 'Revenue & analytics' })).toBeInTheDocument();
    expect(useUnsavedStore.getState().dirty.size).toBe(0);
  });

  it('lets you go without asking when nothing was typed, or once it is saved', async () => {
    const { user, form } = await openJob();
    await user.type(within(form).getByRole('textbox'), 'Refund not applicable');
    await user.click(within(form).getByRole('button', { name: 'Add note' }));
    await within(form).findByRole('textbox', {}, { timeout: 3000 });
    await waitFor(() => expect(within(form).getByRole('textbox')).toHaveValue(''));
    await user.click(within(nav()).getByRole('link', { name: /^Revenue/ }));
    expect(await screen.findByRole('heading', { name: 'Revenue & analytics' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('warns the browser when the tab is closed with unsaved work', async () => {
    const { user, form } = await openJob();
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
    await user.type(within(form).getByRole('textbox'), 'Half a note');
    const warned = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(warned);
    expect(warned.defaultPrevented).toBe(true);
  });
});

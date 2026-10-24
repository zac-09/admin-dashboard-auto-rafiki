import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { isTyping, shortcutFor } from '../shell/shortcutKeys';

async function openAs(role: 'admin' | 'support', path = '/today') {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  await screen.findByRole('navigation', { name: 'Main' });
  return userEvent.setup();
}

describe('keyboard shortcuts', () => {
  it('g then a letter goes to a module the role can open, and nowhere else', () => {
    expect(shortcutFor('g', false, 'admin')).toEqual({ kind: 'pending' });
    expect(shortcutFor('o', true, 'admin')).toEqual({ kind: 'go', to: '/operations' });
    expect(shortcutFor('r', true, 'support')).toBeNull();
    expect(shortcutFor('o', false, 'admin')).toBeNull();
    expect(shortcutFor('/', false, 'support')).toEqual({ kind: 'search' });
    expect(shortcutFor('?', false, 'support')).toEqual({ kind: 'help' });
  });

  it('never while typing', () => {
    const input = document.createElement('input');
    const box = document.createElement('input');
    box.type = 'checkbox';
    expect(isTyping(input)).toBe(true);
    expect(isTyping(document.createElement('textarea'))).toBe(true);
    expect(isTyping(box)).toBe(false);
    expect(isTyping(document.body)).toBe(false);
  });

  it('navigates, opens search, and lists what the role can use', async () => {
    const user = await openAs('admin');
    await user.keyboard('gv');
    expect(await screen.findByRole('heading', { name: 'Mechanic vetting' })).toBeInTheDocument();
    await user.keyboard('/');
    expect(await screen.findByRole('dialog', { name: /search/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.keyboard('?');
    const sheet = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(sheet).getByText('Problem reports')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('typing a note does not trigger a jump', async () => {
    const user = await openAs('admin', '/jobs/job_complete');
    const form = await screen.findByRole('form', { name: 'Add a note' });
    await user.type(within(form).getByRole('textbox'), 'go to vetting');
    expect(screen.queryByRole('heading', { name: 'Mechanic vetting' })).not.toBeInTheDocument();
    expect(within(form).getByRole('textbox')).toHaveValue('go to vetting');
  });
});

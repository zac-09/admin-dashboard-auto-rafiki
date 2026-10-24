import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

const THURSDAY = new Date('2026-10-08T09:00:00Z');
afterEach(() => vi.useRealTimers());

async function openAs(role: 'admin' | 'ops', path: string) {
  vi.useFakeTimers({ now: THURSDAY, toFake: ['Date'] });
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  const view = renderApp(path);
  return { user: userEvent.setup(), view, repos };
}

describe('subscription payment numbers', () => {
  it('an admin sets the number; the overdue reminder then says where to pay', async () => {
    const { user } = await openAs('admin', '/settings');
    const panel = await screen.findByRole('region', {
      name: 'Subscription payments (shown in the app)',
    });
    expect(await within(panel).findByText(/No mobile money number set/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Set payment numbers' }));
    const form = within(panel).getByRole('form', { name: 'Edit payment numbers' });
    await user.type(within(form).getByLabelText('Number 1'), '12345');
    expect(within(form).getByText('A Ugandan mobile number.')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Number 1'));
    await user.type(within(form).getByLabelText('Number 1'), '0772 123 456');
    await user.type(within(form).getByLabelText('Registered name 1'), 'AutoRafiki Ltd');
    await user.type(within(form).getByLabelText(/Reason/), 'Company collection line');
    await user.click(within(form).getByRole('button', { name: 'Save numbers' }));
    expect(
      await within(panel).findByText('MTN +256772123456 (AutoRafiki Ltd)'),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: /^Revenue/ })[0]!);
    const overdue = await screen.findByRole('region', { name: 'Overdue payments' });
    const wa = (await within(overdue).findAllByRole('link', { name: 'WhatsApp reminder' }))[0]!;
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain(
      'Please pay by mobile money to MTN +256772123456 (AutoRafiki Ltd)',
    );
  });

  it('ops see the numbers but cannot change them', async () => {
    await openAs('ops', '/settings');
    const panel = await screen.findByRole('region', {
      name: 'Subscription payments (shown in the app)',
    });
    expect(
      within(panel).queryByRole('button', { name: /payment numbers/ }),
    ).not.toBeInTheDocument();
  });
});

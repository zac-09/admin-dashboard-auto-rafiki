import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

// Thursday 8 Oct 2026, 12:00 Kampala: the week of 5 Oct is overdue for anyone unpaid.
const THURSDAY = new Date('2026-10-08T09:00:00Z');

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  vi.useFakeTimers({ now: THURSDAY, toFake: ['Date'] });
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('subscription tracker', () => {
  it('shows who owes this week, what is collected and who is overdue', async () => {
    await openAs('ops', '/revenue');
    const summary = await screen.findByRole('region', { name: 'Week summary' });
    expect(summary).toHaveTextContent('UGX 15,000 of UGX 30,000');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    const list = screen.getByRole('list', { name: /Subscriptions for 5–11 Oct 2026/ });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringMatching(/^Okello Auto Rescue.*Overdue/),
      expect.stringMatching(/^Namukasa Motors.*Paid.*Mobile money · MP-DEMO-0001/),
    ]);
  });

  it('records a payment: moment, then paid and totals updated', async () => {
    const user = await openAs('admin', '/revenue');
    const list = await screen.findByRole('list', { name: /Subscriptions for/ });
    await user.click(within(list).getByRole('button', { name: 'Mark paid' }));
    const form = screen.getByRole('form', { name: 'Record payment for Okello Auto Rescue' });
    await user.click(within(form).getByRole('radio', { name: 'Cash' }));
    await user.type(within(form).getByLabelText(/Reference/), 'RCPT-77');
    await user.click(within(form).getByRole('button', { name: 'Record UGX 15,000 paid' }));
    expect(await screen.findByText('Payment recorded')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Week summary' })).toHaveTextContent(
      'UGX 30,000 of UGX 30,000',
    );
    expect(screen.getByRole('list', { name: /Subscriptions for/ })).toHaveTextContent(
      /Okello Auto Rescue.*Paid.*Cash · RCPT-77/,
    );
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
  });

  it('cannot step before the tracker started or past this week', async () => {
    await openAs('ops', '/revenue');
    await screen.findByRole('region', { name: 'Week summary' });
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  });

  it('support has no revenue access', async () => {
    await openAs('support', '/revenue');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
  });
});

describe('KPIs', () => {
  it('shows the seven cards for the window', async () => {
    const user = await openAs('ops', '/revenue?view=kpis');
    for (const name of [
      'Jobs per mechanic per week',
      'Request to arrival (median)',
      'Jobs per day',
      'Active mechanics',
      'Acceptance rate',
      'Completion rate',
      'Average rating',
    ]) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('region', { name: 'Request to arrival (median)' })).toHaveTextContent(
      'On target',
    );
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(await screen.findByRole('region', { name: 'Jobs per day' })).toHaveTextContent(
      'in 30 days',
    );
  });

  it('exports the window as CSV', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = await openAs('ops', '/revenue?view=kpis');
    await user.click(await screen.findByRole('button', { name: 'Export jobs CSV' }));
    expect(click).toHaveBeenCalled();
    const text = await created[0]!.text();
    expect(text.split('\r\n')[0]).toMatch(/^\uFEFF?Job id,Requested at,Status/);
    expect(text).toContain('job_enroute_late');
  });
});

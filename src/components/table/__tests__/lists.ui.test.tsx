import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops', path: string) {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

const names = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('link')[0]!.textContent);

describe('sortable, searchable lists', () => {
  it('vetting: filter by any word, sort by a column (asc, desc, back to default)', async () => {
    const user = await openAs('ops', '/vetting?queue=verified');
    const table = await screen.findByRole('table', { name: 'Verified mechanics' });
    const before = names(table);
    expect(before.length).toBeGreaterThan(1);

    const jobs = within(table).getByRole('columnheader', { name: /Jobs/ });
    expect(jobs).toHaveAttribute('aria-sort', 'none');
    await user.click(within(jobs).getByRole('button'));
    expect(jobs).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(jobs).getByRole('button'));
    expect(jobs).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(jobs).getByRole('button'));
    expect(names(table)).toEqual(before);

    await user.type(screen.getByLabelText('Filter mechanics'), before[0]!.split(' ')[0]!);
    expect(names(table)).toContain(before[0]);
    expect(screen.getByText(/\d+ of \d+ shown/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Filter mechanics'));
    await user.type(screen.getByLabelText('Filter mechanics'), 'zzzz nobody');
    expect(screen.getByText('Nothing matches “zzzz nobody”.')).toBeInTheDocument();
  });

  it('subscriptions: sort overdue first, filter by name', async () => {
    const user = await openAs('ops', '/revenue');
    const list = await screen.findByRole('list', { name: /^Subscriptions for/ });
    await user.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('button', { name: /^Status, ascending/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const statuses = within(list)
      .getAllByRole('listitem')
      .map((li) => /Overdue|Due|Paid/.exec(li.textContent ?? '')?.[0]);
    const rank = { Overdue: 0, Due: 1, Paid: 2 } as Record<string, number>;
    expect(statuses.map((s) => rank[s!])).toEqual([...statuses.map((s) => rank[s!])].sort());

    const first = within(within(list).getAllByRole('listitem')[0]!).getAllByRole('link')[0]!;
    await user.type(screen.getByLabelText('Filter mechanics'), first.textContent!);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { Job, Rating } from '@/types';

import { segmentsOf, summarizeCustomers } from '../customers';

const base = (id: string) => structuredClone(JOBS.find((j) => j.id === id)!);
const forCustomer = (job: Job, customerId: string, id: string, at: string): Job => ({
  ...job,
  id,
  request: { ...job.request, id, customerId, createdAt: at },
});
const now = new Date('2026-10-20T09:00:00Z');

describe('customer segments', () => {
  const jobs = [
    // "ghost": asked twice, nobody came either time.
    forCustomer(base('job_cancelled_system'), 'ghost', 'g1', '2026-10-10T09:00:00Z'),
    forCustomer(base('job_cancelled_customer'), 'ghost', 'g2', '2026-10-12T09:00:00Z'),
    // "loyal": two completed jobs, recent.
    forCustomer(base('job_complete'), 'loyal', 'l1', '2026-10-01T09:00:00Z'),
    forCustomer(base('job_complete'), 'loyal', 'l2', '2026-10-18T09:00:00Z'),
    // "gone": served once, nothing since August.
    forCustomer(base('job_complete'), 'gone', 'x1', '2026-08-20T09:00:00Z'),
  ];
  const rating = (id: string, stars: Rating['stars']): Rating => ({
    id,
    jobId: 'l1',
    mechanicId: 'u_mech_okello',
    customerId: 'loyal',
    ratedBy: 'mechanic',
    stars,
    createdAt: '2026-10-02T09:00:00Z',
  });

  it('never served, lapsed, repeat and flagged', () => {
    const summaries = summarizeCustomers(jobs, [rating('a', 2), rating('b', 2)]);
    const seg = (id: string) =>
      segmentsOf(
        summaries.find((c) => c.customerId === id)!,
        now,
      );
    expect(seg('ghost')).toEqual(['never-served']);
    expect(seg('loyal')).toEqual(['repeat', 'flagged']);
    expect(seg('gone')).toEqual(['lapsed']);
    expect(summaries.find((c) => c.customerId === 'loyal')!.ratedByMechanics).toEqual({
      average: 2,
      count: 2,
      lowest: 2,
    });
  });

  it('one low rating alone does not flag anyone', () => {
    const summaries = summarizeCustomers(jobs, [rating('a', 1)]);
    expect(
      segmentsOf(
        summaries.find((c) => c.customerId === 'loyal')!,
        now,
      ),
    ).toEqual(['repeat']);
  });
});

describe('customers page', () => {
  it('opens on never-served customers; support can use it', async () => {
    const store = new MockOperationsStore(new Date(), { history: true });
    const at = new Date(Date.now() - 2 * 86_400_000).toISOString();
    store.putJob(forCustomer(base('job_cancelled_system'), 'u_customer_new', 'job_new_ghost', at));
    const repos = createMockRepositories(store);
    await repos.auth.signIn('support@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/customers');
    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Never served' });
    const [row] = within(list).getAllByRole('listitem');
    expect(row).toHaveTextContent(/1 request · 0 completed · 1 unanswered/);
    expect(await within(row!).findByRole('link', { name: 'No name set' })).toHaveAttribute(
      'href',
      '/support/people/u_customer_new',
    );
    await user.click(screen.getByRole('button', { name: /Repeat customers/ }));
    const repeat = await screen.findByRole('list', { name: 'Repeat customers' });
    expect(await within(repeat).findByRole('link', { name: 'Aisha Nakato' })).toBeInTheDocument();
  });
});

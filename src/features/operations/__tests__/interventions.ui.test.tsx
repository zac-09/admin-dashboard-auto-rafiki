import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  const store = new MockOperationsStore();
  const repos = createMockRepositories(store);
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { user: userEvent.setup(), store };
}

const panel = () => screen.getByRole('region', { name: 'Interventions' });

describe('interventions', () => {
  it('widens an open request: wider radii only, fresh window, noted and visible', async () => {
    const { user, store } = await openAs('ops', '/jobs/job_req_stale');
    await user.click(
      await within(await screen.findByRole('region', { name: 'Interventions' })).findByRole(
        'button',
        { name: 'Widen the search' },
      ),
    );
    const form = within(panel()).getByRole('form', { name: 'Widen the search' });
    // The stale fixture is already at 8 km: renew at 8 or go wider, never narrower.
    expect(
      within(form)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['8 km (renew)', '10 km', '12 km', '15 km', '20 km', '30 km']);
    await user.click(within(form).getByRole('radio', { name: '12 km' }));
    await user.type(within(form).getByLabelText(/Reason/), 'No taker for 4 minutes');
    const before = Date.now();
    await user.click(within(form).getByRole('button', { name: 'Widen to 12 km' }));
    expect(await screen.findByText('Search widened')).toBeInTheDocument();
    const job = store.jobs.get('job_req_stale')!;
    expect(job.radiusKm).toBe(12);
    expect(Date.parse(job.expiresAt) - before).toBeGreaterThanOrEqual(89_000);
    expect(await screen.findByRole('list', { name: 'Support notes' })).toHaveTextContent(
      /Ops action.*Broadcast widened from 8 km to 12 km by ops: No taker for 4 minutes/,
    );
    expect(screen.getByRole('region', { name: 'Request' })).toHaveTextContent(
      'Broadcast radius12 km',
    );
  });

  it('opens the widen form straight from the alert rail', async () => {
    const { user } = await openAs('ops', '/operations');
    const rail = await screen.findByRole('region', { name: 'Alerts' });
    await user.click(await within(rail).findByRole('link', { name: 'Widen search' }));
    expect(await screen.findByRole('form', { name: 'Widen the search' })).toBeInTheDocument();
  });

  it('cancels an on-the-way job as AutoRafiki support, with a reason', async () => {
    const { user, store } = await openAs('admin', '/jobs/job_enroute_late');
    await user.click(
      await within(await screen.findByRole('region', { name: 'Interventions' })).findByRole(
        'button',
        { name: 'Cancel this job' },
      ),
    );
    const form = within(panel()).getByRole('form', { name: 'Cancel this job' });
    expect(form).toHaveTextContent('The customer and the mechanic get a notification');
    const confirm = within(form).getByRole('button', { name: 'Cancel job for the customer' });
    expect(confirm).toBeDisabled();
    await user.type(within(form).getByLabelText(/Reason/), 'Mechanic unreachable for 40 minutes');
    await user.click(confirm);
    expect(await screen.findByText('Job cancelled')).toBeInTheDocument();
    const job = store.jobs.get('job_enroute_late')!;
    expect(job).toMatchObject({ status: 'cancelled', cancelledBy: 'admin' });
    expect(job.timeline.at(-1)?.status).toBe('cancelled');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Flat tyre · Car' }).parentElement,
      ).toHaveTextContent('Cancelled by AutoRafiki support'),
    );
  });

  it('offers no cancel once the mechanic has arrived or work started', async () => {
    await openAs('ops', '/jobs/job_working');
    const interventions = await screen.findByRole('region', { name: 'Interventions' });
    expect(
      within(interventions).queryByRole('button', { name: 'Cancel this job' }),
    ).not.toBeInTheDocument();
    expect(
      within(interventions).queryByRole('button', { name: 'Widen the search' }),
    ).not.toBeInTheDocument();
  });

  it('support sees no interventions and no alert shortcut', async () => {
    await openAs('support', '/operations');
    const rail = await screen.findByRole('region', { name: 'Alerts' });
    // Wait for the alerts themselves, then check no shortcut was offered.
    await within(rail).findByText(/No taker for/);
    expect(within(rail).queryByRole('link', { name: 'Widen search' })).not.toBeInTheDocument();
  });
});

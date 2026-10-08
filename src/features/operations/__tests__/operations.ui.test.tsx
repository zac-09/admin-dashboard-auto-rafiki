import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import type { Job } from '@/types';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'support', path: string) {
  const store = new MockOperationsStore();
  const repos = createMockRepositories(store);
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { store, user: userEvent.setup() };
}

const column = (name: string) => screen.getByRole('region', { name });

function newRequest(id: string, minutesAgo: number): Job {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const base = JOBS.find((j) => j.id === 'job_req_stale')!;
  return {
    ...base,
    id,
    request: {
      ...base.request,
      id,
      createdAt: at,
      location: { ...base.request.location, label: `Spot ${id}` },
    },
    timeline: [{ status: 'requested', at }],
  };
}

describe('live operations board', () => {
  it('shows jobs by status with time in status, and flags the stale request', async () => {
    await openAs('admin', '/operations');
    const requested = await screen.findByRole('region', { name: 'Requested' });
    expect(requested).toHaveTextContent('Dead battery · Car');
    expect(requested).toHaveTextContent('No taker yet');
    expect(requested).toHaveTextContent('4 min in status');
    expect(column('On the way')).toHaveTextContent('On the way over 30 min');
    expect(column('On the way')).toHaveTextContent('Namukasa Motors');
    expect(column('Working')).toHaveTextContent('Engine trouble · Matatu');
    // Fixture jobs closed over 24 h ago are outside the board's closed-jobs window.
    expect(column('Complete')).toHaveTextContent('No jobs');
    expect(column('Cancelled')).toHaveTextContent('No jobs');
    expect(screen.getByText(/active jobs/).closest('p')).toHaveTextContent(
      '3 active jobs · 2 mechanics online (2 receiving jobs)',
    );
  });

  it('lists the alerts: stale request, late mechanic, low rating', async () => {
    await openAs('admin', '/operations');
    const rail = await screen.findByRole('region', { name: 'Alerts' });
    const items = within(rail)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      expect.stringMatching(/^No taker for 4 min/),
      expect.stringMatching(/^On the way for 38 min/),
      expect.stringMatching(/^2 stars: Mechanic rated the customer/),
    ]);
  });

  it('shows recently closed jobs with who cancelled', async () => {
    const { store } = await openAs('admin', '/operations');
    await screen.findByRole('region', { name: 'Requested' });
    const job = newRequest('job_timeout', 5);
    act(() =>
      store.putJob({
        ...job,
        status: 'cancelled',
        cancelledBy: 'system',
        timeline: [...job.timeline, { status: 'cancelled', at: new Date().toISOString() }],
      }),
    );
    expect(column('Cancelled')).toHaveTextContent('Cancelled no mechanic accepted in time');
  });

  it('updates live: a new request appears, then moves when matched', async () => {
    const { store } = await openAs('admin', '/operations');
    await screen.findByRole('region', { name: 'Requested' });
    const job = newRequest('job_live', 0.5);
    act(() => store.putJob(job));
    expect(column('Requested')).toHaveTextContent('Spot job_live');
    act(() =>
      store.putJob({
        ...job,
        status: 'matched',
        mechanicId: 'u_mech_okello',
        timeline: [...job.timeline, { status: 'matched', at: new Date().toISOString() }],
      }),
    );
    expect(column('Requested')).not.toHaveTextContent('Spot job_live');
    expect(column('Mechanic assigned')).toHaveTextContent('Spot job_live');
    expect(column('Mechanic assigned')).toHaveTextContent('Okello Auto Rescue');
  });

  it('fires the alert rail when a request sits unaccepted for over 2 minutes', async () => {
    const { store } = await openAs('admin', '/operations');
    const rail = await screen.findByRole('region', { name: 'Alerts' });
    act(() => store.putJob(newRequest('job_quiet', 1)));
    expect(within(rail).queryByText(/Spot job_quiet/)).not.toBeInTheDocument();
    act(() => store.putJob(newRequest('job_waiting', 3.5)));
    expect(within(rail).getByText('Dead battery, Spot job_waiting')).toBeInTheDocument();
    expect(
      within(rail).getByText('Dead battery, Spot job_waiting').previousSibling,
    ).toHaveTextContent('No taker for 3 min');
  });
});

describe('job detail and interventions', () => {
  it('shows the timeline and both parties, and suspends the mechanic with an audit trail', async () => {
    const { user } = await openAs('admin', '/jobs/job_enroute_late');
    expect(await screen.findByRole('heading', { name: 'Flat tyre · Car' })).toBeInTheDocument();
    const timeline = screen.getByRole('region', { name: 'Timeline' });
    // Three steps done (the last one is "now"), three still to come on the path.
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Requested/),
      expect.stringMatching(/^Mechanic assigned/),
      expect.stringMatching(/^On the way · now/),
      'ArrivedNot yet',
      'WorkingNot yet',
      'CompleteNot yet',
    ]);
    const people = screen.getByRole('region', { name: 'People' });
    expect(await within(people).findByText('Aisha Nakato')).toBeInTheDocument();
    expect(within(people).getByRole('link', { name: '+256772123456' })).toHaveAttribute(
      'href',
      'tel:+256772123456',
    );
    expect(await within(people).findByRole('link', { name: 'Namukasa Motors' })).toHaveAttribute(
      'href',
      '/support/people/u_mech_namukasa',
    );
    expect(within(people).getByRole('link', { name: 'Aisha Nakato' })).toHaveAttribute(
      'href',
      '/support/people/u_customer_aisha',
    );

    await user.type(screen.getByLabelText(/Reason/), 'Abandoned the customer');
    await user.click(screen.getByRole('button', { name: 'Suspend Namukasa Motors' }));
    expect(
      await screen.findByText('Namukasa Motors is suspended and receives no new job broadcasts.'),
    ).toBeInTheDocument();

    await user.click(within(people).getByRole('link', { name: 'Vetting record' }));
    const history = await screen.findByRole('region', { name: 'Vetting history' });
    // The page and its history load on demand: wait for the entry, not just the panel.
    await waitFor(() =>
      expect(history).toHaveTextContent(
        /Suspended.*Abandoned the customer \(job job_enroute_late\)/,
      ),
    );
  });

  it('support sees the job but cannot intervene', async () => {
    await openAs('support', '/jobs/job_enroute_late');
    expect(
      await screen.findByText('Your role can view jobs but not intervene.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Suspend mechanic' })).not.toBeInTheDocument();
  });

  it('says so when the job does not exist', async () => {
    await openAs('admin', '/jobs/nope');
    expect(await screen.findByText('No job with id nope.')).toBeInTheDocument();
  });
});

describe('requested items (the app cart)', () => {
  it('shows cart items on the card as catalogue labels, unknown ids as themselves', async () => {
    await openAs('admin', '/operations');
    const requested = await screen.findByRole('region', { name: 'Requested' });
    expect(requested).toHaveTextContent('Jump start · legacy-item');
    expect(column('On the way')).toHaveTextContent('Puncture repair · New tube');
  });

  it('lists them on the job page, and says so when a job has none', async () => {
    await openAs('admin', '/jobs/job_enroute_late');
    const items = await screen.findByRole('list', { name: 'Requested items' });
    expect(
      within(items)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Puncture repair', 'New tube']);
  });

  it('a job without items reads "Nothing specific"', async () => {
    await openAs('admin', '/jobs/job_working');
    expect(await screen.findByText('Nothing specific')).toBeInTheDocument();
  });
});

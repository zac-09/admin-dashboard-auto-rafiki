import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { usePalette } from '../paletteStore';

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  usePalette.setState({ open: false });
  renderApp(path);
  return userEvent.setup();
}

describe('support search', () => {
  it('finds a person by phone however it is typed, and opens their history', async () => {
    const user = await openAs('support', '/support');
    await user.type(
      await screen.findByLabelText(/Phone number, job id or business name/),
      '0772 123 456',
    );
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    await user.click(within(results).getByRole('option', { name: /Aisha Nakato/ }));
    expect(await screen.findByRole('heading', { name: 'Aisha Nakato' })).toBeInTheDocument();
    const jobs = screen.getByRole('region', { name: 'Jobs as a customer' });
    expect(within(jobs).getAllByRole('link').length).toBeGreaterThanOrEqual(3);
  });

  it('finds a mechanic by part of the business name', async () => {
    const user = await openAs('support', '/support');
    await user.type(await screen.findByLabelText(/Phone number/), 'rescue');
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    expect(
      within(results).getByRole('option', { name: /Mechanic.*Okello Auto Rescue/ }),
    ).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = await openAs('support', '/support');
    await user.type(await screen.findByLabelText(/Phone number/), 'zzzz');
    expect(await screen.findByText(/Nothing matches “zzzz”/)).toBeInTheDocument();
  });

  it('opens from anywhere with ⌘K and goes to a job with Enter', async () => {
    const user = await openAs('ops', '/vetting');
    await screen.findByRole('heading', { name: 'Mechanic vetting' });
    await user.keyboard('{Meta>}k{/Meta}');
    const dialog = await screen.findByRole('dialog', { name: 'Search' });
    await user.type(within(dialog).getByRole('combobox'), 'job_enroute_late');
    await within(dialog).findByRole('option', { name: /Flat tyre/ });
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Flat tyre · Car' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
  });
});

describe('the job record', () => {
  it('shows the chat transcript and ratings in both directions', async () => {
    await openAs('support', '/jobs/job_enroute_late');
    const chat = await screen.findByRole('list', { name: 'Chat transcript' });
    expect(
      within(chat)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringMatching(/^Customer.*Are you close\?/),
      expect.stringMatching(/^Mechanic.*Traffic at the Jinja Road lights/),
    ]);
  });

  it('shows how each side rated the other', async () => {
    await openAs('support', '/jobs/job_complete');
    const ratings = await screen.findByRole('region', { name: 'Ratings' });
    expect(ratings).toHaveTextContent(/Customer rated the mechanic.*5 of 5.*Came fast/);
    expect(ratings).toHaveTextContent(/Mechanic rated the customer.*2 of 5.*Wrong pin/);
  });

  it('adds an internal note', async () => {
    const user = await openAs('support', '/jobs/job_enroute_late');
    await user.type(
      await screen.findByLabelText('New note'),
      'Customer called twice, mechanic stuck in traffic',
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    const notes = await screen.findByRole('list', { name: 'Support notes' });
    expect(notes).toHaveTextContent(/Note.*support@autorafiki\.test.*Customer called twice/);
    expect(screen.getByLabelText('New note')).toHaveValue('');
  });
});

describe('disputes', () => {
  it('flags a dispute, which lands on the open-disputes list and in the notes', async () => {
    const user = await openAs('support', '/jobs/job_enroute_late');
    await user.type(
      await screen.findByLabelText('What is disputed'),
      'Customer says the mechanic never came',
    );
    await user.click(screen.getByRole('button', { name: 'Flag a dispute' }));
    expect(await screen.findByText('Open dispute')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Support notes' })).toHaveTextContent(/Dispute opened/);
    await user.click(screen.getByRole('link', { name: 'Support' }));
    const open = await screen.findByRole('region', { name: 'Open disputes' });
    expect(within(open).getAllByRole('listitem')).toHaveLength(2);
  });

  it('support resolves a dispute but cannot pick the suspension outcome', async () => {
    const user = await openAs('support', '/jobs/job_complete');
    const form = await screen.findByRole('form', { name: 'Resolve the dispute' });
    expect(within(form).getByRole('radio', { name: /Mechanic suspended/ })).toBeDisabled();
    expect(within(form).getByText('Needs an admin or ops role')).toBeInTheDocument();
    await user.click(within(form).getByRole('radio', { name: /Mechanic warned/ }));
    await user.type(
      within(form).getByLabelText('Resolution note'),
      'Warned about explaining the work',
    );
    await user.click(within(form).getByRole('button', { name: 'Resolve dispute' }));
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dispute' })).toHaveTextContent(
      /Mechanic warned.*Warned about/,
    );
    // Resolved, so the job offers a fresh flag rather than a second resolve.
    expect(screen.getByRole('form', { name: 'Flag a dispute' })).toBeInTheDocument();
  });

  it('an admin resolving with a suspension suspends the mechanic, audited', async () => {
    const user = await openAs('admin', '/jobs/job_complete');
    const form = await screen.findByRole('form', { name: 'Resolve the dispute' });
    await user.click(within(form).getByRole('radio', { name: /Mechanic suspended/ }));
    await user.type(within(form).getByLabelText('Resolution note'), 'Third complaint this month');
    await user.click(within(form).getByRole('button', { name: 'Resolve dispute' }));
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Vetting record' }));
    expect(await screen.findByRole('heading', { name: 'Okello Auto Rescue' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vetting history' })).toHaveTextContent(
      /Suspended.*Dispute on job job_complete: Third complaint this month/,
    );
  });
});

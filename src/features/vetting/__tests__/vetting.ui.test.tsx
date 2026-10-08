import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { ASSESSMENT_CHECKLIST } from '@/lib/vetting';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { user: userEvent.setup(), repos };
}

function rowFor(name: string) {
  return screen.getByRole('link', { name }).closest('tr') as HTMLElement;
}

describe('vetting queues', () => {
  it('lists pending applicants with their last rejection, and counts every queue', async () => {
    await openAs('admin', '/vetting');
    expect(await screen.findByRole('link', { name: 'Kato Battery & Tyre' })).toBeInTheDocument();
    expect(rowFor('Kato Battery & Tyre')).toHaveTextContent(/Rejected .*working battery tester/);
    expect(rowFor('Ssempala Boda Fix')).toHaveTextContent('New application');
    const tabs = screen.getByRole('navigation', { name: 'Vetting queues' });
    expect(within(tabs).getByRole('button', { name: /Pending/ })).toHaveTextContent('Pending2');
    expect(within(tabs).getByRole('button', { name: /^Verified/ })).toHaveTextContent('Verified2');
    expect(within(tabs).getByRole('button', { name: /Suspended/ })).toHaveTextContent('Suspended1');
    expect(within(tabs).getByRole('button', { name: /Re-verification/ })).toHaveTextContent(
      'Re-verification1',
    );
  });

  it('surfaces mechanics due for re-verification, including those with no record', async () => {
    const { user } = await openAs('admin', '/vetting');
    await user.click(await screen.findByRole('button', { name: /Re-verification/ }));
    expect(rowFor('Okello Auto Rescue')).toHaveTextContent('No verification on record');
    expect(screen.queryByRole('link', { name: 'Namukasa Motors' })).not.toBeInTheDocument();
  });

  it('shows why a mechanic is suspended', async () => {
    const { user } = await openAs('ops', '/vetting');
    await user.click(await screen.findByRole('button', { name: /Suspended/ }));
    expect(rowFor('Waiswa Heavy Recovery')).toHaveTextContent(/Suspended .*overcharging/);
  });
});

describe('vetting decisions', () => {
  it('approving needs the full checklist and a reason, then verifies and records it', async () => {
    const { user } = await openAs('admin', '/vetting/u_mech_ssempala');
    await user.click(await screen.findByRole('radio', { name: /Approve/ }));
    const submit = screen.getByRole('button', { name: 'Approve Ssempala Boda Fix' });
    expect(submit).toBeDisabled();
    for (const item of ASSESSMENT_CHECKLIST) {
      await user.click(screen.getByRole('checkbox', { name: item.label }));
    }
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), 'Passed the practical');
    await user.click(submit);
    expect(await screen.findByText(/Approve: saved and recorded/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ssempala Boda Fix' }).parentElement,
    ).toHaveTextContent('Verified');
    const history = screen.getByRole('region', { name: 'Vetting history' });
    expect(history).toHaveTextContent(/Approved.*admin@autorafiki\.test/);
    expect(history).toHaveTextContent('Assessment: 5 of 5 items confirmed');
    // Re-verification and suspension are now the options.
    expect(screen.getByRole('radio', { name: /Re-verify/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Reject/ })).not.toBeInTheDocument();
  });

  it('a rejection keeps the applicant pending and lands in the history', async () => {
    const { user } = await openAs('ops', '/vetting/u_mech_ssempala');
    await user.click(await screen.findByRole('radio', { name: /Reject/ }));
    await user.type(screen.getByLabelText(/Reason/), 'No riding permit yet');
    await user.click(screen.getByRole('button', { name: 'Reject Ssempala Boda Fix' }));
    expect(await screen.findByText(/Reject: saved/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ssempala Boda Fix' }).parentElement,
    ).toHaveTextContent('Pending');
    expect(screen.getByRole('region', { name: 'Vetting history' })).toHaveTextContent(
      /Rejected.*No riding permit yet/,
    );
  });

  it('offers reinstate and reject (not suspend) for a suspended mechanic', async () => {
    await openAs('admin', '/vetting/u_mech_waiswa');
    expect(await screen.findByRole('radio', { name: /Reinstate/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Reject/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Suspend/ })).not.toBeInTheDocument();
  });

  it('support can view a mechanic but gets no decision form', async () => {
    await openAs('support', '/vetting/u_mech_ssempala');
    expect(
      await screen.findByText('Your role can view vetting but not decide.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Vetting decision' })).not.toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Vetting documents' })).toBeInTheDocument();
  });

  it('says so when the mechanic does not exist', async () => {
    await openAs('admin', '/vetting/nobody');
    expect(await screen.findByText('No mechanic profile with id nobody.')).toBeInTheDocument();
  });
});

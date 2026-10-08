import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  const repos = createMockRepositories();
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return userEvent.setup();
}

const docRow = (name: string) =>
  within(screen.getByRole('list', { name: 'Vetting documents' })).getByRole('listitem', { name });

describe('vetting documents', () => {
  it('shows what a boda applicant uploaded, inline, and flags the missing permit', async () => {
    await openAs('ops', '/vetting/u_mech_ssempala');
    const list = await screen.findByRole('list', { name: 'Vetting documents' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['National ID', 'Mechanic certification', 'Riding permit']);
    const id = docRow('National ID');
    expect(id).toHaveTextContent('Awaiting review');
    expect(id).toHaveTextContent(/v1 · 403 KB · uploaded/);
    expect(
      await within(id).findByRole('img', { name: 'National ID, as uploaded' }),
    ).toBeInTheDocument();
    const cert = docRow('Mechanic certification');
    expect(cert).toHaveTextContent('v2');
    expect(await within(cert).findByTitle('Mechanic certification (PDF)')).toBeInTheDocument();
    expect(docRow('Riding permit')).toHaveTextContent('Not uploaded');
    expect(screen.getByLabelText('Documents standing')).toHaveTextContent(
      '0 of 3 verified · 1 not uploaded · 2 awaiting review',
    );
  });

  it('verifies and rejects documents with a reason; the standing and history follow', async () => {
    const user = await openAs('admin', '/vetting/u_mech_ssempala');
    await screen.findByRole('list', { name: 'Vetting documents' });
    await user.click(
      within(docRow('National ID')).getByRole('button', { name: 'Verify National ID' }),
    );
    const verify = within(docRow('National ID')).getByRole('form', { name: 'Verify National ID' });
    await user.type(
      within(verify).getByLabelText(/What you checked/),
      'Matches the person at the yard',
    );
    await user.click(within(verify).getByRole('button', { name: 'Mark verified' }));
    expect(await screen.findByText('National ID verified')).toBeInTheDocument();
    expect(await within(docRow('National ID')).findByText('Verified')).toBeInTheDocument();
    expect(docRow('National ID')).toHaveTextContent(
      /Verified by admin@autorafiki\.test.*Matches the person/,
    );

    await user.click(
      within(docRow('Mechanic certification')).getByRole('button', { name: 'Reject…' }),
    );
    const reject = within(docRow('Mechanic certification')).getByRole('form', {
      name: 'Reject Mechanic certification',
    });
    await user.type(within(reject).getByLabelText(/Why it is rejected/), 'Expired in 2024');
    await user.click(within(reject).getByRole('button', { name: 'Mark rejected' }));
    expect(
      await within(docRow('Mechanic certification')).findByText('Rejected'),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Documents standing')).toHaveTextContent(
      '1 of 3 verified · 1 not uploaded · 1 rejected',
    );
    expect(screen.getByRole('region', { name: 'Vetting history' })).toHaveTextContent(
      /Expired in 2024/,
    );
  });

  it('a car mechanic needs no permit; nothing uploaded reads as such', async () => {
    await openAs('ops', '/vetting/u_mech_kato');
    await screen.findByText(/Nothing uploaded yet/);
    const list = screen.getByRole('list', { name: 'Vetting documents' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['National ID', 'Mechanic certification']);
  });

  it('support sees the documents but cannot review them', async () => {
    await openAs('support', '/vetting/u_mech_ssempala');
    const list = await screen.findByRole('list', { name: 'Vetting documents' });
    expect(within(list).queryByRole('button', { name: /Verify|Reject/ })).not.toBeInTheDocument();
  });
});

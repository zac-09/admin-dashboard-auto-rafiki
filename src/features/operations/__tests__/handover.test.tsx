import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

describe('shift handover', () => {
  it('support writes a note for the next shift, ops marks it handled', async () => {
    const repos = createMockRepositories();
    await repos.auth.signIn('support@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/operations');
    const user = userEvent.setup();

    const panel = await screen.findByRole('region', { name: 'Shift handover' });
    expect(await within(panel).findByText('Nothing handed over.')).toBeInTheDocument();
    const form = within(panel).getByRole('form', { name: 'New handover note' });
    expect(within(form).getByRole('button', { name: 'Add note' })).toBeDisabled();
    await user.type(
      within(form).getByRole('textbox', { name: /Note for the next shift/ }),
      'Customer at Bugolobi called twice; mechanic stuck in traffic.',
    );
    await user.type(within(form).getByRole('textbox', { name: /Job id/ }), 'job_enroute_late');
    await user.click(within(form).getByRole('button', { name: 'Add note' }));

    const open = await within(panel).findByRole('list', { name: 'Open handover notes' });
    const [note] = within(open).getAllByRole('listitem');
    expect(note).toHaveTextContent(
      /Customer at Bugolobi called twice.*support@autorafiki.test \(Support\).*job job_enroute_late/,
    );
    expect(within(note!).getByRole('link', { name: 'job job_enroute_late' })).toHaveAttribute(
      'href',
      '/jobs/job_enroute_late',
    );
    expect(panel).toHaveTextContent('1 open');

    await user.click(within(note!).getByRole('button', { name: /Mark handled/ }));
    expect(await within(panel).findByText('Nothing handed over.')).toBeInTheDocument();
    expect(within(panel).getByText('Handled in the last 24 hours (1)')).toBeInTheDocument();
  });
});

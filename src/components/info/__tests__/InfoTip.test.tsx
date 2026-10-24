import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { METRICS } from '@/lib/metrics';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { InfoTip } from '../InfoTip';

describe('explanations on numbers', () => {
  it('opens on click, says what, how and why, and closes with Escape or a click away', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <InfoTip metric="arrival" label="request to arrival" />
        <p>Elsewhere</p>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'About request to arrival' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(METRICS.arrival.what);
    expect(note).toHaveTextContent(METRICS.arrival.why);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    await user.click(button);
    await user.click(screen.getByText('Elsewhere'));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('every KPI card explains itself', async () => {
    const repos = createMockRepositories();
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/revenue?view=kpis');
    for (const name of [
      'Jobs per mechanic per week',
      'Request to arrival (median)',
      'Jobs per day',
      'Active mechanics',
      'Acceptance rate',
      'Completion rate',
      'Average rating',
    ]) {
      const card = await screen.findByRole('region', { name });
      expect(within(card).getByRole('button', { name: `About ${name}` })).toBeInTheDocument();
    }
  });
});

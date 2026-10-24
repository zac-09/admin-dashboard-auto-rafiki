import { render, screen, within } from '@testing-library/react';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { formatExact } from '@/lib/format';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

import { Since } from '../Since';

describe('exact time behind a relative one', () => {
  it('shows the exact Kampala time on hover and carries it as a <time>', () => {
    render(<Since at="2026-10-24T11:05:32.000Z">12 min ago</Since>);
    const time = screen.getByText('12 min ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2026-10-24T11:05:32.000Z');
    expect(time).toHaveAttribute('title', 'Sat, 24 Oct 2026, 14:05:32 (Kampala time)');
    expect(formatExact('2026-10-24T21:30:00.000Z')).toBe(
      'Sun, 25 Oct 2026, 00:30:00 (Kampala time)',
    );
  });

  it('job cards and alerts say exactly when the job entered its status', async () => {
    const repos = createMockRepositories();
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/operations');
    const alerts = await screen.findByRole('region', { name: 'Alerts' });
    const times = await within(alerts).findAllByText(/^\d+ (s|min|h)/, { selector: 'time' });
    expect(times[0]).toHaveAttribute('title', expect.stringMatching(/\(Kampala time\)$/));
    const board = screen.getByRole('region', { name: 'Requested' });
    expect(within(board).getAllByText(/in status$/, { selector: 'time' })[0]).toHaveAttribute(
      'dateTime',
    );
  });
});

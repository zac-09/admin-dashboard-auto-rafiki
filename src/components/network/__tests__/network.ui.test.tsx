import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useToasts } from '@/components/toast/toastStore';
import { formatAgo } from '@/lib/format';

import { Freshness } from '../Freshness';
import { OfflineBanner } from '../OfflineBanner';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  useToasts.setState({ toasts: [] });
});

describe('connection and freshness', () => {
  it('says when the connection drops, and confirms when it is back', async () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(await screen.findByText('You are offline. Reconnecting…')).toBeInTheDocument();
    act(() => setOnline(true));
    expect(useToasts.getState().toasts.map((t) => t.title)).toEqual(['Back online']);
  });

  it('shows when read-once numbers were loaded, and reloads them', async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <Freshness updatedAt={Date.now() - 5 * 60_000} fetching={false} onRefresh={onRefresh} />,
    );
    expect(screen.getByText('5 min ago', { selector: 'time' })).toHaveAttribute('title');
    expect(screen.getByText(/^Updated/).textContent).toBe('Updated 5 min ago');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    rerender(<Freshness updatedAt={Date.now()} fetching onRefresh={onRefresh} />);
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true');
  });

  it('says how long ago in plain words', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    expect(formatAgo(now - 20_000, now)).toBe('just now');
    expect(formatAgo(now - 4 * 60_000, now)).toBe('4 min ago');
    expect(formatAgo(now - 2 * 3_600_000, now)).toBe('2 h ago');
    expect(formatAgo(now - 86_400_000, now)).toBe('1 day ago');
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { Toaster, TOAST_MS } from '../Toaster';
import { MAX_TOASTS, toast, useToasts } from '../toastStore';

const renderToaster = () =>
  render(
    <MemoryRouter>
      <Toaster />
    </MemoryRouter>,
  );

afterEach(() => {
  useToasts.setState({ toasts: [] });
  vi.useRealTimers();
});

describe('toasts', () => {
  it('announces politely, links to the result, and can be dismissed', async () => {
    renderToaster();
    act(() => {
      toast({ title: 'Note added', body: 'Staff only.', link: { to: '/audit', label: 'View' } });
    });
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Note addedStaff only.View');
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/audit');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss: Note added' }));
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('leaves on its own after a few seconds, and keeps only the newest few', () => {
    vi.useFakeTimers();
    renderToaster();
    act(() => {
      for (let i = 1; i <= MAX_TOASTS + 1; i++) toast({ title: `Toast ${i}` });
    });
    expect(useToasts.getState().toasts.map((t) => t.title)).toEqual([
      'Toast 2',
      'Toast 3',
      'Toast 4',
    ]);
    act(() => vi.advanceTimersByTime(TOAST_MS + 10));
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});

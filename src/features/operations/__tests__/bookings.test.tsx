import { screen, within } from '@testing-library/react';

import { arrivalMinutes } from '@/features/insights/jobFacts';
import { demand } from '@/features/insights/demand';
import { bookingWindow, isBooking, jobTitle } from '@/lib/jobs';
import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS, MECHANICS } from '@/lib/mocks/contractFixtures';
import { upcomingBookings } from '@/lib/mocks/historyFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { Job } from '@/types';

import { computeAlerts } from '../alerts';

const now = new Date('2026-10-16T09:00:00Z'); // 12:00 Kampala
const booking = (hoursUntilWindow: number, over: Partial<Job> = {}): Job => {
  const base = structuredClone(JOBS.find((j) => j.id === 'job_req_stale')!);
  const window = now.getTime() + hoursUntilWindow * 3_600_000;
  return {
    ...base,
    id: `b${hoursUntilWindow}`,
    request: {
      ...base.request,
      id: `b${hoursUntilWindow}`,
      service: 'other',
      items: [],
      createdAt: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
      booking: {
        packageId: 'minor-service',
        packageLabel: 'Minor service',
        scheduledFor: new Date(window).toISOString(),
        windowMinutes: 120,
      },
    },
    expiresAt: new Date(window - 2 * 3_600_000).toISOString(),
    timeline: [{ status: 'requested', at: new Date(now.getTime() - 2 * 86_400_000).toISOString() }],
    ...over,
  };
};

describe('bookings are scheduled, not urgent', () => {
  it('names the package and the window', () => {
    const b = booking(24);
    expect(isBooking(b)).toBe(true);
    expect(jobTitle(b)).toBe('Minor service');
    expect(bookingWindow(b.request.booking!)).toBe('Sat 17 Oct, 12:00–14:00');
  });

  it('never a stale request or out of reach, however long it waits', () => {
    const alerts = computeAlerts([booking(48)], [], now, { online: [], radiusKm: 5 });
    expect(alerts).toEqual([]);
  });

  it('flags an unconfirmed booking within 6 hours of its cutoff, soonest first', () => {
    const alerts = computeAlerts([booking(7), booking(4), booking(1)], [], now, {
      online: MECHANICS,
      radiusKm: 5,
    });
    // Windows in 7, 4 and 1 hours: cutoffs in 5, 2 and -1 hours.
    expect(alerts.map((a) => [a.kind, a.key])).toEqual([
      ['booking-unconfirmed', 'booking-unconfirmed:b1'],
      ['booking-unconfirmed', 'booking-unconfirmed:b4'],
      ['booking-unconfirmed', 'booking-unconfirmed:b7'],
    ]);
    // Confirmed (matched) bookings raise nothing.
    expect(
      computeAlerts([booking(4, { status: 'matched', mechanicId: 'u_mech_okello' })], [], now),
    ).toEqual([]);
  });

  it('has no request-to-arrival time and is left out of demand by hour', () => {
    const arrived = booking(24, {
      status: 'arrived',
      timeline: [
        { status: 'requested', at: '2026-10-14T09:00:00Z' },
        { status: 'arrived', at: '2026-10-17T09:10:00Z' },
      ],
    });
    expect(arrivalMinutes(arrived)).toBeNull();
    expect(demand([booking(24)]).maxRequests).toBe(0);
  });
});

describe('bookings in the control room', () => {
  it('cards say when it is booked for; the rail flags the one close to its cutoff', async () => {
    const store = new MockOperationsStore();
    const [, confirmed] = upcomingBookings(new Date());
    store.putJob(confirmed!);
    // Waiting, with its window 5 hours away: 3 hours left before the cutoff.
    const t = Date.now();
    const soon = new Date(t + 5 * 3_600_000).toISOString();
    const base = structuredClone(JOBS.find((j) => j.id === 'job_req_stale')!);
    store.putJob({
      ...base,
      id: 'job_booking_soon',
      request: {
        ...base.request,
        id: 'job_booking_soon',
        service: 'other',
        items: [],
        booking: {
          packageId: 'minor-service',
          packageLabel: 'Minor service',
          scheduledFor: soon,
          windowMinutes: 120,
        },
      },
      expiresAt: new Date(t + 3 * 3_600_000).toISOString(),
      fee: 180_000,
    });
    const repos = createMockRepositories(store);
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/operations');

    const requested = await screen.findByRole('region', { name: 'Requested' });
    expect(requested).toHaveTextContent(/Booking not confirmed.*Booked for .*Minor service · Car/);
    expect(requested).toHaveTextContent('Waiting for a mechanic to confirm');
    expect(screen.getByRole('region', { name: 'Mechanic assigned' })).toHaveTextContent(
      /Booked for .*Oil and filter change/,
    );
    const rail = screen.getByRole('region', { name: 'Alerts' });
    expect(
      within(rail).getByText(/^Booking not confirmed: (2 h \d+ min|3 h) left to confirm$/),
    ).toBeInTheDocument();
    expect(
      within(rail).getByRole('link', { name: 'Message mechanics near here' }),
    ).toBeInTheDocument();
    expect(within(rail).queryByText(/Minor service.*No taker/)).not.toBeInTheDocument();
    expect(screen.getByText(/active jobs/).closest('p')).toHaveTextContent('(2 booked services)');
  });
});

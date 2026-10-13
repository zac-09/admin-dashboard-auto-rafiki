import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { Job } from '@/types';

import type { Alert } from '../alerts';
import { useDesktopAlerts } from '../notifications/desktopAlerts';
import { MAX_INDIVIDUAL, planNotifications } from '../notifications/plan';

/** A stand-in for the browser's Notification that records what was shown. */
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  static shown: FakeNotification[] = [];
  onclick: (() => void) | null = null;
  readonly title: string;
  readonly options: NotificationOptions;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    FakeNotification.shown.push(this);
  }
  close() {}
}

beforeEach(() => {
  FakeNotification.shown = [];
  FakeNotification.permission = 'granted';
  vi.stubGlobal('Notification', FakeNotification);
  useDesktopAlerts.setState({ enabled: false, permission: 'default' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

async function openAs(role: 'admin' | 'support', path: string) {
  const store = new MockOperationsStore();
  const repos = createMockRepositories(store);
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { store, user: userEvent.setup() };
}

const stale = (id: string): Alert => {
  const job = { ...JOBS[0]!, id } as Job;
  return { kind: 'stale-request', key: `stale-request:${id}`, job, ms: 4 * 60_000 };
};

describe('planning desktop alerts', () => {
  it('only new alerts, each with a link to its job', () => {
    const plan = planNotifications([stale('a'), stale('b')], new Set(['stale-request:a']));
    expect(plan).toEqual([
      {
        tag: 'stale-request:b',
        title: 'No mechanic has taken a request for 4 min',
        body: 'Dead battery, Ntinda Shopping Centre',
        path: '/jobs/b',
      },
    ]);
  });

  it('a burst becomes one summary pointing at the control room', () => {
    const many = Array.from({ length: MAX_INDIVIDUAL + 1 }, (_, i) => stale(`j${i}`));
    const plan = planNotifications(many, new Set());
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ title: '4 alerts need attention', path: '/operations' });
  });
});

describe('desktop alerts', () => {
  it('the operator turns them on from the alert rail; the browser is asked once', async () => {
    FakeNotification.permission = 'default';
    const { user } = await openAs('admin', '/operations');
    const toggle = await screen.findByRole('button', { name: 'Desktop alerts: off' });
    FakeNotification.requestPermission.mockImplementationOnce(async () => {
      FakeNotification.permission = 'granted';
      return 'granted';
    });
    await user.click(toggle);
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Desktop alerts: on' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem('autorafiki.desktopAlerts')).toBe('on');
  });

  it('says so when the browser has blocked them', async () => {
    useDesktopAlerts.setState({ permission: 'denied' });
    await openAs('admin', '/operations');
    expect(
      await screen.findByText("Desktop alerts blocked in this browser's site settings"),
    ).toBeInTheDocument();
  });

  it('fires from any page, once per alert, and new alerts fire as they appear', async () => {
    useDesktopAlerts.setState({ enabled: true, permission: 'granted' });
    const { store } = await openAs('admin', '/vetting');
    await screen.findByRole('heading', { name: 'Mechanic vetting' });
    // The fixtures hold a stale request, a late mechanic and a 2-star rating: three at once.
    await waitFor(() => expect(FakeNotification.shown).toHaveLength(3));
    expect(FakeNotification.shown.map((n) => n.title)).toEqual([
      'No mechanic has taken a request for 4 min',
      expect.stringMatching(/^Mechanic on the way for/),
      '2-star rating',
    ]);

    const at = new Date(Date.now() - 3 * 60_000).toISOString();
    const base = JOBS.find((j) => j.id === 'job_req_stale')!;
    act(() =>
      store.putJob({
        ...base,
        id: 'job_new',
        request: { ...base.request, id: 'job_new', createdAt: at },
        timeline: [{ status: 'requested', at }],
      }),
    );
    await waitFor(() => expect(FakeNotification.shown).toHaveLength(4));
    expect(FakeNotification.shown[3]!.options.tag).toBe('stale-request:job_new');
  });

  it('nothing fires while they are off, even with the browser allowing them', async () => {
    useDesktopAlerts.setState({ enabled: false, permission: 'granted' });
    await openAs('admin', '/vetting');
    await screen.findByRole('heading', { name: 'Mechanic vetting' });
    expect(FakeNotification.shown).toHaveLength(0);
  });
});

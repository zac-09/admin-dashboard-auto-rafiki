import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { JOBS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import type { Job } from '@/types';
import { renderApp } from '@/test/renderApp';

const desktopMatchMedia = window.matchMedia;

/** Phone layout: every `min-width` query fails. */
function asPhone() {
  window.matchMedia = ((query: string) => ({
    ...desktopMatchMedia(query),
    matches: false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = desktopMatchMedia;
});

async function openAs(path: string, store = new MockOperationsStore()) {
  const repos = createMockRepositories(store);
  await repos.auth.signIn('admin@autorafiki.test', MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { user: userEvent.setup(), store };
}

describe('shell polish', () => {
  it('names the browser tab after the page, with the alert count on operations', async () => {
    await openAs('/vetting');
    await screen.findByRole('heading', { name: 'Mechanic vetting' });
    expect(document.title).toBe('Vetting · AutoRafiki Ops');
  });

  it('puts the live alert count in the operations tab title', async () => {
    await openAs('/operations');
    await screen.findByRole('region', { name: 'Alerts' });
    expect(document.title).toBe('(3) Live operations · AutoRafiki Ops');
  });

  it('opens the phone menu as a dialog that Escape closes', async () => {
    asPhone();
    const { user } = await openAs('/vetting');
    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(within(drawer).getByRole('link', { name: 'Operations' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});

describe('vetting polish', () => {
  it('opens a mechanic from anywhere on the row', async () => {
    const { user } = await openAs('/vetting');
    const row = (await screen.findByRole('link', { name: 'Ssempala Boda Fix' })).closest('tr')!;
    await user.click(within(row).getByText('Boda'));
    expect(await screen.findByRole('heading', { name: 'Ssempala Boda Fix' })).toBeInTheDocument();
  });

  it('shows one card per mechanic on a phone instead of the table', async () => {
    asPhone();
    await openAs('/vetting');
    const list = await screen.findByRole('list', { name: 'Pending mechanics' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says what the decision button is waiting for', async () => {
    const { user } = await openAs('/vetting/u_mech_ssempala');
    expect(await screen.findByText('Choose a decision')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Approve/ }));
    expect(screen.getByText('0 of 5 checks done')).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) await user.click(box);
    expect(screen.getByText('Add a reason for the audit log')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Approve Ssempala Boda Fix' });
    expect(submit).toHaveAccessibleDescription('Add a reason for the audit log');
  });
});

describe('sign-in polish', () => {
  it('shows and hides the password', async () => {
    setRepositoriesForTesting(createMockRepositories());
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/login');
    const user = userEvent.setup();
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('operations polish', () => {
  function newRequest(id: string): Job {
    const at = new Date().toISOString();
    const base = JOBS.find((j) => j.id === 'job_req_stale')!;
    return {
      ...base,
      id,
      request: { ...base.request, id, createdAt: at },
      timeline: [{ status: 'requested', at }],
    };
  }

  it('reports the connection as Live', async () => {
    await openAs('/operations');
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });

  it('glows a card that arrives while watching, not the ones already there', async () => {
    const { store } = await openAs('/operations');
    const requested = await screen.findByRole('region', { name: 'Requested' });
    expect(requested.querySelector('.fresh')).toBeNull();
    act(() => store.putJob(newRequest('job_new')));
    expect(requested.querySelectorAll('.fresh')).toHaveLength(1);
  });

  it('shows one status column at a time on a phone, with a switcher', async () => {
    asPhone();
    const { user } = await openAs('/operations');
    const switcher = await screen.findByRole('navigation', { name: 'Job status' });
    // Starts on the first column with work in it.
    expect(screen.getByRole('region', { name: 'Requested' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Working' })).not.toBeInTheDocument();
    await user.click(within(switcher).getByRole('button', { name: /Working/ }));
    expect(screen.getByRole('region', { name: 'Working' })).toHaveTextContent('Engine trouble');
  });
});

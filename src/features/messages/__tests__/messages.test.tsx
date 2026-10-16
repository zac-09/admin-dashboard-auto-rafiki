import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { checkMessage, recipients, audienceLabel } from '@/lib/mechanicMessages';
import { createMockRepositories, MOCK_PASSWORD, MockOperationsStore } from '@/lib/mocks';
import { MECHANICS, PLACES } from '@/lib/mocks/contractFixtures';
import type { MockMessagesRepository } from '@/lib/mocks/mockMessagesRepository';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';

describe('who a message reaches', () => {
  it('near: verified mechanics within the radius of the place', () => {
    const near = { kind: 'near' as const, ...PLACES.nakawa, radiusKm: 3 };
    expect(recipients(MECHANICS, near).map((m) => m.userId)).toEqual([
      'u_mech_okello',
      'u_mech_namukasa',
    ]);
    expect(recipients(MECHANICS, { ...near, radiusKm: 1 }).map((m) => m.userId)).toEqual([
      'u_mech_namukasa',
    ]);
    expect(audienceLabel(near)).toBe('verified mechanics within 3 km of Nakawa, Jinja Road');
  });

  it('named: any status, applicants included', () => {
    const named = { kind: 'mechanics' as const, mechanicIds: ['u_mech_kato', 'u_mech_okello'] };
    expect(
      recipients(MECHANICS, named)
        .map((m) => m.userId)
        .sort(),
    ).toEqual(['u_mech_kato', 'u_mech_okello']);
  });

  it('validates text and audience the same way the function does', () => {
    const base = { title: 'Hi', body: 'Body', audience: { kind: 'verified' } };
    expect(checkMessage(base)).toMatchObject({ ok: true });
    expect(checkMessage({ ...base, title: 'x'.repeat(61) })).toEqual({
      ok: false,
      error: 'Keep the title to 60 characters.',
    });
    expect(
      checkMessage({
        ...base,
        audience: { kind: 'near', latitude: 0.3, longitude: 32.6, radiusKm: 99 },
      }),
    ).toEqual({
      ok: false,
      error: 'Choose a radius up to 50 km.',
    });
    expect(checkMessage({ ...base, audience: { kind: 'everyone' } })).toMatchObject({ ok: false });
  });
});

// The mock history is generated relative to "now"; pin it so the worst gap is always Mukono.
const PINNED = new Date('2026-10-15T09:00:00Z');
afterEach(() => vi.useRealTimers());

async function openAs(role: 'admin' | 'ops' | 'support', path: string) {
  vi.useFakeTimers({ now: PINNED, toFake: ['Date'] });
  const repos = createMockRepositories(new MockOperationsStore(new Date(), { history: true }));
  await repos.auth.signIn(`${role}@autorafiki.test`, MOCK_PASSWORD);
  setRepositoriesForTesting(repos);
  useSessionStore.setState({ status: 'loading', session: null });
  renderApp(path);
  return { repos, user: userEvent.setup() };
}

describe('messages page', () => {
  it('sends to verified mechanics near the worst coverage gap, then lists it with reads', async () => {
    const { repos, user } = await openAs('ops', '/messages');
    const form = await screen.findByRole('form', { name: 'New message to mechanics' });
    const area = await within(form).findByRole('combobox', { name: 'Area' });
    expect(area).toHaveDisplayValue(
      /^Mukono, Jinja Road \(\d+ unanswered, nearest mechanic 15 km\)$/,
    );
    await user.click(within(form).getByRole('button', { name: '15 km' }));
    expect(within(form).getByRole('button', { name: /^Send to/ })).toBeDisabled();
    // Mukono, the worst gap, has no verified mechanic within 15 km: the composer says so.
    expect(form).toHaveTextContent('Nobody matches yet: widen the radius or pick another audience');
    await user.selectOptions(area, within(area).getByRole('option', { name: /^Najjera/ }));
    await user.click(within(form).getByRole('button', { name: '10 km' }));
    await user.type(within(form).getByRole('textbox', { name: /Title/ }), 'Cover needed tonight');
    await user.type(
      within(form).getByRole('textbox', { name: /Message/ }),
      'Requests near you are going unanswered after 6 pm.',
    );
    expect(form).toHaveTextContent(/Reaches \d+ mechanics?: \d+ by push now/);
    await user.click(within(form).getByRole('button', { name: /^Send to \d+ mechanics?$/ }));
    expect(await screen.findByText('Message sent')).toBeInTheDocument();

    const sent = await screen.findByRole('list', { name: 'Messages sent' });
    const [item] = within(sent).getAllByRole('listitem');
    expect(item).toHaveTextContent(
      /Cover needed tonight.*to verified mechanics within 10 km of Najjera/,
    );
    const messages = repos.messages as MockMessagesRepository;
    const [record] = await messages.listSent();
    messages.reads.set(record!.id, new Set([record!.recipientIds[0]!]));
    await user.click(within(item!).getByRole('button', { name: 'Who has read it?' }));
    expect(
      await within(item!).findByText(`Read by 1 of ${record!.recipientIds.length}`),
    ).toBeInTheDocument();
  });

  it('opens from a mechanic page with that mechanic chosen', async () => {
    const { user } = await openAs('admin', '/vetting/u_mech_kato');
    await user.click(await screen.findByRole('link', { name: 'Message this mechanic' }));
    const form = await screen.findByRole('form', { name: 'New message to mechanics' });
    expect(within(form).getByRole('radio', { name: /Chosen mechanics/ })).toBeChecked();
    expect(within(form).getByRole('checkbox', { name: /Kato Battery & Tyre/ })).toBeChecked();
    expect(form).toHaveTextContent('Reaches 1 mechanic: 0 by push now');
  });

  it('support cannot message mechanics', async () => {
    await openAs('support', '/messages');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
  });
});

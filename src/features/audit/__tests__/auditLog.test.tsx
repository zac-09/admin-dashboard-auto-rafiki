import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { filterAudit, auditActors, auditTargetPath } from '@/lib/auditActions';
import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { AUDIT_ENTRIES } from '@/lib/mocks/auditFixtures';
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

const entries = () =>
  within(screen.getByRole('list', { name: 'Audit entries' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '');

describe('audit filters', () => {
  it('match by action, actor and free text over subject and reason', () => {
    const all = AUDIT_ENTRIES;
    expect(
      filterAudit(all, { action: 'mechanic.vetting.suspend', actor: null, text: '' }).map(
        (e) => e.targetLabel,
      ),
    ).toEqual(['Waiswa Heavy Recovery']);
    expect(filterAudit(all, { action: null, actor: null, text: 'nakawa yard' })).toHaveLength(1);
    const ops = filterAudit(all, { action: null, actor: 'staff-ops', text: '' });
    expect(ops.every((e) => e.actorEmail === 'ops@autorafiki.test')).toBe(true);
    expect(auditActors(all).map((a) => a.label)).toContain('admin@autorafiki.test');
  });

  it('links each subject to its page', () => {
    expect(auditTargetPath({ targetType: 'mechanic', targetId: 'u1' })).toBe('/vetting/u1');
    expect(auditTargetPath({ targetType: 'job', targetId: 'j1' })).toBe('/jobs/j1');
    expect(auditTargetPath({ targetType: 'subscription', targetId: 'u1_2026-10-05' })).toBe(
      '/revenue',
    );
  });
});

describe('audit log page', () => {
  it('answers "who suspended this mechanic and why" from the filters', async () => {
    const user = await openAs('ops', '/audit?window=all');
    await screen.findByRole('list', { name: 'Audit entries' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Action' }),
      'Mechanic suspended',
    );
    expect(entries()).toEqual([
      expect.stringMatching(
        /Mechanic suspended.*Waiswa Heavy Recovery.*admin@autorafiki.test \(Admin\).*Three 1-star ratings/,
      ),
    ]);
    expect(
      within(screen.getByRole('list', { name: 'Audit entries' })).getByRole('link', {
        name: 'Waiswa Heavy Recovery',
      }),
    ).toHaveAttribute('href', '/vetting/u_mech_waiswa');
  });

  it('shows new decisions and filters by free text', async () => {
    const user = await openAs('admin', '/audit?window=all&q=battery%20tester');
    await screen.findByRole('list', { name: 'Audit entries' });
    expect(entries()).toEqual([expect.stringMatching(/Mechanic rejected.*Kato Battery & Tyre/)]);
    await user.clear(screen.getByRole('searchbox', { name: 'Search the log' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the log' }), 'no such thing');
    expect(screen.getByText(/Nothing recorded matches/)).toBeInTheDocument();
  });

  it('support cannot open the audit log and has no link to it', async () => {
    await openAs('support', '/audit');
    expect(
      await screen.findByRole('heading', { name: 'Not available for your role' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });
});

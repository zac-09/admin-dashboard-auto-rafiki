import type { HandoverNote } from '../../src/types/handover';
import { addHandoverNote, markHandoverHandled, type HandoverDeps } from '../src/handover';
import type { Caller } from '../src/setUserRole';

const SUPPORT: Caller = { uid: 's1', email: 'support@autorafiki.test', role: 'support' };
const NOW = '2026-10-15T18:00:00.000Z';

function world() {
  const notes = new Map<string, Omit<HandoverNote, 'id'>>();
  const deps: HandoverDeps = {
    async add(note) {
      const id = `n${notes.size + 1}`;
      notes.set(id, note);
      return id;
    },
    async markHandled(id, by) {
      const n = notes.get(id);
      if (!n) return 'missing';
      if (n.handledAt) return 'already';
      notes.set(id, { ...n, handledAt: by.at, handledBy: by.uid, handledByEmail: by.email });
      return 'ok';
    },
    now: () => new Date(NOW),
  };
  return { deps, notes };
}

describe('handover notes', () => {
  it('any staff role writes one, with author and an optional job', async () => {
    const { deps, notes } = world();
    await addHandoverNote(SUPPORT, { text: '  Watching job_x  ', jobId: 'job_x' }, deps);
    expect(notes.get('n1')).toEqual({
      text: 'Watching job_x',
      jobId: 'job_x',
      at: NOW,
      authorUid: 's1',
      authorEmail: 'support@autorafiki.test',
      authorRole: 'support',
      handledAt: null,
      handledBy: null,
      handledByEmail: null,
    });
  });

  it('is marked handled once', async () => {
    const { deps, notes } = world();
    await addHandoverNote(SUPPORT, { text: 'x' }, deps);
    await markHandoverHandled(SUPPORT, { id: 'n1' }, deps);
    expect(notes.get('n1')).toMatchObject({ handledAt: NOW, handledBy: 's1' });
    await expect(markHandoverHandled(SUPPORT, { id: 'n1' }, deps)).rejects.toThrow(/already/);
    await expect(markHandoverHandled(SUPPORT, { id: 'nope' }, deps)).rejects.toThrow(/no longer/);
  });

  it('refuses app users, empty or long notes, and path-like ids', async () => {
    const { deps } = world();
    const appUser: Caller = { uid: 'u', email: null, role: null };
    await expect(addHandoverNote(appUser, { text: 'x' }, deps)).rejects.toThrow(/staff/);
    await expect(addHandoverNote(null, { text: 'x' }, deps)).rejects.toThrow(/Sign in/);
    await expect(addHandoverNote(SUPPORT, { text: ' ' }, deps)).rejects.toThrow(/Write/);
    await expect(addHandoverNote(SUPPORT, { text: 'x'.repeat(1001) }, deps)).rejects.toThrow(
      /1000/,
    );
    await expect(markHandoverHandled(SUPPORT, { id: 'a/b' }, deps)).rejects.toThrow(/Which/);
  });
});

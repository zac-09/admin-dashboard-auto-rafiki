import type { VettingStatus } from '../../src/lib/vetting';
import type { AuditEntry } from '../../src/types/audit';
import type { Dispute, SupportNote } from '../../src/types/support';
import type { Caller } from '../src/setUserRole';
import {
  addSupportNote,
  flagDispute,
  resolveDispute,
  type JobSnapshot,
  type SupportDeps,
} from '../src/support';

const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };
const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const SUPPORT: Caller = { uid: 's1', email: 'support@autorafiki.test', role: 'support' };

/** In-memory Firestore with real transaction rules: reads before writes, all-or-nothing. */
function world() {
  const jobs: Record<string, JobSnapshot> = {
    j1: { customerId: 'c1', mechanicId: 'm1', label: 'Flat tyre, Bugolobi' },
    j2: { customerId: 'c2', mechanicId: null, label: 'Fuel, Ntinda' },
  };
  const mechanics: Record<string, { vetting: VettingStatus; businessName: string }> = {
    m1: { vetting: 'verified', businessName: 'Namukasa Motors' },
  };
  const disputes: Record<string, Dispute> = {};
  const notes: Omit<SupportNote, 'id'>[] = [];
  const audit: Omit<AuditEntry, 'id'>[] = [];

  const deps: SupportDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      let wrote = false;
      const read = <T>(v: T) => {
        if (wrote) throw new Error('Firestore transactions must read before writing');
        return Promise.resolve(structuredClone(v));
      };
      const write = (w: () => void) => {
        wrote = true;
        writes.push(w);
      };
      await run({
        getJob: (id) => read(jobs[id] ?? null),
        getDispute: (id) => read(disputes[id] ?? null),
        getMechanic: (id) => read(mechanics[id] ?? null),
        setDispute: (id, d) => write(() => (disputes[id] = d)),
        addNote: (_id, n) => write(() => notes.push(n)),
        setVetting: (id, v) => write(() => (mechanics[id]!.vetting = v)),
        audit: (e) => write(() => audit.push(e)),
      });
      writes.forEach((w) => w()); // only reached when run() did not throw
    },
    now: () => new Date('2026-10-06T09:00:00.000Z'),
  };
  return { deps, jobs, mechanics, disputes, notes, audit };
}

describe('addSupportNote', () => {
  it('lets every role add an internal note to an existing job', async () => {
    const w = world();
    for (const who of [ADMIN, OPS, SUPPORT]) {
      await addSupportNote(who, { jobId: 'j1', text: ` Called ${who.role} ` }, w.deps);
    }
    expect(w.notes.map((n) => [n.kind, n.text, n.authorEmail])).toEqual([
      ['note', 'Called admin', 'admin@autorafiki.test'],
      ['note', 'Called ops', 'ops@autorafiki.test'],
      ['note', 'Called support', 'support@autorafiki.test'],
    ]);
  });

  it('rejects signed-out callers, app users, empty or long notes, and unknown jobs', async () => {
    const w = world();
    await expect(addSupportNote(null, { jobId: 'j1', text: 'x' }, w.deps)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      addSupportNote(
        { uid: 'u', email: null, role: undefined },
        { jobId: 'j1', text: 'x' },
        w.deps,
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(addSupportNote(ADMIN, { jobId: 'j1', text: '  ' }, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(
      addSupportNote(ADMIN, { jobId: 'j1', text: 'x'.repeat(1001) }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(addSupportNote(ADMIN, { jobId: 'nope', text: 'x' }, w.deps)).rejects.toMatchObject(
      { code: 'not-found' },
    );
    expect(w.notes).toHaveLength(0);
  });
});

describe('flagDispute', () => {
  it('opens a dispute with the parties, notes it on the job and audits it', async () => {
    const w = world();
    await flagDispute(
      SUPPORT,
      { jobId: 'j1', reason: 'Customer says the tyre was not fixed' },
      w.deps,
    );
    expect(w.disputes.j1).toMatchObject({
      status: 'open',
      customerId: 'c1',
      mechanicId: 'm1',
      jobLabel: 'Flat tyre, Bugolobi',
      openedByEmail: 'support@autorafiki.test',
    });
    expect(w.notes.map((n) => n.kind)).toEqual(['dispute-opened']);
    expect(w.audit).toEqual([
      expect.objectContaining({
        action: 'job.dispute.open',
        targetType: 'job',
        targetId: 'j1',
        before: null,
        after: 'open',
        actorRole: 'support',
      }),
    ]);
  });

  it('refuses a second open dispute but allows reopening a resolved one', async () => {
    const w = world();
    await flagDispute(OPS, { jobId: 'j1', reason: 'first' }, w.deps);
    await expect(flagDispute(OPS, { jobId: 'j1', reason: 'again' }, w.deps)).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    await resolveDispute(
      OPS,
      { jobId: 'j1', outcome: 'no-fault', note: 'Checked the chat' },
      w.deps,
    );
    await flagDispute(OPS, { jobId: 'j1', reason: 'came back' }, w.deps);
    expect(w.disputes.j1?.status).toBe('open');
    expect(w.audit.at(-1)).toMatchObject({ before: 'resolved', after: 'open' });
  });
});

describe('resolveDispute', () => {
  it('records the outcome, notes it and audits it', async () => {
    const w = world();
    await flagDispute(SUPPORT, { jobId: 'j1', reason: 'Overcharged' }, w.deps);
    await resolveDispute(
      SUPPORT,
      { jobId: 'j1', outcome: 'mechanic-warned', note: 'Warned by phone' },
      w.deps,
    );
    expect(w.disputes.j1).toMatchObject({
      status: 'resolved',
      resolution: {
        outcome: 'mechanic-warned',
        note: 'Warned by phone',
        resolvedByEmail: 'support@autorafiki.test',
      },
    });
    expect(w.notes.map((n) => n.kind)).toEqual(['dispute-opened', 'dispute-resolved']);
    expect(w.audit.map((a) => a.action)).toEqual(['job.dispute.open', 'job.dispute.resolve']);
    expect(w.mechanics.m1?.vetting).toBe('verified');
  });

  it('suspends the mechanic in the same transaction, audited as a vetting decision too', async () => {
    const w = world();
    await flagDispute(OPS, { jobId: 'j1', reason: 'Abandoned the customer' }, w.deps);
    await resolveDispute(
      OPS,
      { jobId: 'j1', outcome: 'mechanic-suspended', note: 'Second incident' },
      w.deps,
    );
    expect(w.mechanics.m1?.vetting).toBe('suspended');
    expect(w.audit.at(-1)).toMatchObject({
      action: 'mechanic.vetting.suspend',
      targetId: 'm1',
      before: 'verified',
      after: 'suspended',
      reason: 'Dispute on job j1: Second incident',
    });
  });

  it('support cannot suspend; nothing is written', async () => {
    const w = world();
    await flagDispute(SUPPORT, { jobId: 'j1', reason: 'x' }, w.deps);
    await expect(
      resolveDispute(SUPPORT, { jobId: 'j1', outcome: 'mechanic-suspended', note: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(w.disputes.j1?.status).toBe('open');
    expect(w.mechanics.m1?.vetting).toBe('verified');
  });

  it('refuses without an open dispute, without a mechanic to suspend, or a suspended mechanic', async () => {
    const w = world();
    await expect(
      resolveDispute(ADMIN, { jobId: 'j1', outcome: 'no-fault', note: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await flagDispute(ADMIN, { jobId: 'j2', reason: 'x' }, w.deps);
    await expect(
      resolveDispute(ADMIN, { jobId: 'j2', outcome: 'mechanic-suspended', note: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    w.mechanics.m1!.vetting = 'suspended';
    await flagDispute(ADMIN, { jobId: 'j1', reason: 'x' }, w.deps);
    await expect(
      resolveDispute(ADMIN, { jobId: 'j1', outcome: 'mechanic-suspended', note: 'x' }, w.deps),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringMatching(/already suspended/),
    });
    expect(w.disputes.j1?.status).toBe('open');
  });

  it('rejects unknown outcomes and empty notes', async () => {
    const w = world();
    await flagDispute(ADMIN, { jobId: 'j1', reason: 'x' }, w.deps);
    await expect(
      resolveDispute(ADMIN, { jobId: 'j1', outcome: 'refund', note: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      resolveDispute(ADMIN, { jobId: 'j1', outcome: 'no-fault', note: ' ' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

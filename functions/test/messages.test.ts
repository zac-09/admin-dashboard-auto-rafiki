import type { Reachable } from '../../src/lib/mechanicMessages';
import type { AuditEntry } from '../../src/types/audit';
import { sendMechanicMessage, type MessageDeps, type PushTarget } from '../src/messages';
import type { Caller } from '../src/setUserRole';

const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const SUPPORT: Caller = { uid: 's1', email: 'support@autorafiki.test', role: 'support' };
const NOW = '2026-10-14T12:00:00.000Z';
const KIRA = { latitude: 0.3972, longitude: 32.6398, label: 'Kira' };
const KOLOLO = { latitude: 0.3339, longitude: 32.5931, label: 'Kololo' };

const MECHANICS: Reachable[] = [
  { userId: 'near', vetting: 'verified', lastKnownLocation: KIRA, fcmToken: 'tok-near' },
  { userId: 'far', vetting: 'verified', lastKnownLocation: KOLOLO },
  { userId: 'applicant', vetting: 'pending', lastKnownLocation: KIRA, fcmToken: 'tok-app' },
];

function world(push: MessageDeps['push'] = async (t) => ({ sent: t.length, failed: 0 })) {
  const state = {
    record: null as unknown,
    inbox: new Map<string, unknown>(),
    audit: [] as Omit<AuditEntry, 'id'>[],
    pushed: [] as PushTarget[],
    recorded: null as unknown,
  };
  const deps: MessageDeps = {
    listMechanics: async () => MECHANICS,
    newId: () => 'msg1',
    async commit({ record, inbox, audit }) {
      state.record = record;
      for (const i of inbox) state.inbox.set(i.mechanicId, i.doc);
      state.audit.push(audit);
    },
    async push(targets, message) {
      state.pushed.push(...targets);
      return push(targets, message);
    },
    async recordPush(_id, result) {
      state.recorded = result;
    },
    now: () => new Date(NOW),
  };
  return { deps, state };
}

const msg = (audience: unknown) => ({
  title: 'Kira needs cover tonight',
  body: 'Requests near Kira go unanswered after 6 pm.',
  audience,
});

describe('sendMechanicMessage', () => {
  it('reaches verified mechanics near a place: inbox copy each, push where there is a token, audited', async () => {
    const { deps, state } = world();
    const result = await sendMechanicMessage(
      OPS,
      msg({ kind: 'near', ...KIRA, radiusKm: 5 }),
      deps,
    );
    expect(result).toEqual({ id: 'msg1', recipients: 1, pushed: 1, pushFailed: 0, withoutPush: 0 });
    expect([...state.inbox.entries()]).toEqual([
      [
        'near',
        {
          title: 'Kira needs cover tonight',
          body: 'Requests near Kira go unanswered after 6 pm.',
          sentAt: NOW,
          readAt: null,
        },
      ],
    ]);
    expect(state.pushed).toEqual([{ mechanicId: 'near', token: 'tok-near' }]);
    expect(state.audit[0]).toMatchObject({
      action: 'mechanic.message.send',
      targetType: 'message',
      targetId: 'msg1',
      targetLabel:
        '"Kira needs cover tonight" to 1 mechanic (verified mechanics within 5 km of Kira)',
      actorRole: 'ops',
    });
    expect(state.recorded).toEqual({ sent: 1, failed: 0 });
  });

  it('named mechanics include applicants; those without a token still get the inbox copy', async () => {
    const { deps, state } = world();
    const result = await sendMechanicMessage(
      OPS,
      msg({ kind: 'mechanics', mechanicIds: ['far', 'applicant', 'far'] }),
      deps,
    );
    expect(result).toMatchObject({ recipients: 2, pushed: 1, withoutPush: 1 });
    expect([...state.inbox.keys()].sort()).toEqual(['applicant', 'far']);
  });

  it('all verified mechanics', async () => {
    const { deps, state } = world();
    await sendMechanicMessage(OPS, msg({ kind: 'verified' }), deps);
    expect([...state.inbox.keys()].sort()).toEqual(['far', 'near']);
  });

  it('a push outage still leaves the messages delivered to the inbox', async () => {
    const { deps, state } = world(async () => {
      throw new Error('FCM down');
    });
    const result = await sendMechanicMessage(OPS, msg({ kind: 'verified' }), deps);
    expect(result).toMatchObject({ recipients: 2, pushed: 0, pushFailed: 1 });
    expect(state.inbox.size).toBe(2);
  });

  it('refuses support, empty or long text, an empty audience, and nobody matching', async () => {
    const { deps, state } = world();
    await expect(sendMechanicMessage(SUPPORT, msg({ kind: 'verified' }), deps)).rejects.toThrow(
      /cannot message/,
    );
    await expect(sendMechanicMessage(null, msg({ kind: 'verified' }), deps)).rejects.toThrow(
      /Sign in/,
    );
    await expect(
      sendMechanicMessage(OPS, { ...msg({ kind: 'verified' }), title: ' ' }, deps),
    ).rejects.toThrow(/title is required/);
    await expect(
      sendMechanicMessage(OPS, { ...msg({ kind: 'verified' }), body: 'x'.repeat(501) }, deps),
    ).rejects.toThrow(/500 characters/);
    await expect(
      sendMechanicMessage(OPS, msg({ kind: 'mechanics', mechanicIds: [] }), deps),
    ).rejects.toThrow(/at least one/);
    await expect(
      sendMechanicMessage(OPS, msg({ kind: 'mechanics', mechanicIds: ['../x'] }), deps),
    ).rejects.toThrow(/at least one/);
    await expect(
      sendMechanicMessage(OPS, msg({ kind: 'near', ...KIRA, radiusKm: 0.5, latitude: 1.5 }), deps),
    ).rejects.toThrow(/Nobody matches/);
    expect(state.inbox.size).toBe(0);
    expect(state.audit).toHaveLength(0);
  });
});

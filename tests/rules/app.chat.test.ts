import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

import { listMessages, sendMessage } from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv } from './env';
import { baseWorld, jobDoc, UID } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({ ...baseWorld(), 'jobs/j1': jobDoc('j1', 'enroute') });
});

const fromCustomer = {
  jobId: 'j1',
  senderId: UID.customer,
  senderRole: 'customer' as const,
  text: 'Are you close?',
};
const fromMechanic = {
  jobId: 'j1',
  senderId: UID.mechanic,
  senderRole: 'mechanic' as const,
  text: 'Five minutes.',
};

describe('app path: jobs/{jobId}/messages', () => {
  it('both parties send (with the id bookkeeping write) and read the thread', async () => {
    await assertSucceeds(sendMessage(appUser(UID.customer), fromCustomer));
    await assertSucceeds(sendMessage(appUser(UID.mechanic), fromMechanic));
    const thread = await assertSucceeds(listMessages(appUser(UID.customer), 'j1'));
    expect(thread.size).toBe(2);
    await assertSucceeds(listMessages(appUser(UID.mechanic), 'j1'));
  });

  it('outsiders neither read nor write', async () => {
    await sendMessage(appUser(UID.customer), fromCustomer);
    await assertFails(listMessages(appUser(UID.otherCustomer), 'j1'));
    await assertFails(listMessages(appUser(UID.otherMechanic), 'j1'));
    await assertFails(listMessages(anonymous(), 'j1'));
    await assertFails(
      sendMessage(appUser(UID.otherMechanic), { ...fromMechanic, senderId: UID.otherMechanic }),
    );
  });

  it('rejects impersonation, the wrong role, empty and over-long text', async () => {
    const db = appUser(UID.customer);
    await assertFails(sendMessage(db, { ...fromCustomer, senderId: UID.mechanic }));
    await assertFails(sendMessage(db, { ...fromCustomer, senderRole: 'mechanic' }));
    await assertFails(sendMessage(db, { ...fromCustomer, text: '' }));
    await assertFails(sendMessage(db, { ...fromCustomer, text: 'x'.repeat(501) }));
    await assertFails(sendMessage(db, { ...fromCustomer, jobId: 'other' }));
  });

  it('messages are immutable after the id write and never deleted', async () => {
    const db = appUser(UID.customer);
    const ref = await addDoc(collection(db, 'jobs', 'j1', 'messages'), {
      ...fromCustomer,
      createdAt: new Date().toISOString(),
    });
    await assertSucceeds(updateDoc(ref, { id: ref.id }));
    await assertFails(updateDoc(ref, { text: 'edited' }));
    await assertFails(updateDoc(doc(appUser(UID.mechanic), ref.path), { id: ref.id }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDoc(doc(appUser(UID.mechanic), ref.path)));
  });
});

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { anonymous, appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { baseWorld, jobDoc, UID } from './world';

const NOTE = {
  jobId: 'j1',
  kind: 'note',
  text: 'Called the customer',
  authorUid: 'staff_ops',
  authorEmail: 'ops@autorafiki.test',
  createdAt: '2026-10-06T09:00:00.000Z',
};
const DISPUTE = {
  jobId: 'j1',
  status: 'open',
  customerId: UID.customer,
  mechanicId: UID.mechanic,
  jobLabel: 'Dead battery, Kololo',
  reason: 'Overcharged',
  openedBy: 'staff_ops',
  openedByEmail: 'ops@autorafiki.test',
  openedAt: '2026-10-06T09:00:00.000Z',
};

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({
    ...baseWorld(),
    'jobs/j1': jobDoc('j1', 'complete'),
    'jobs/j1/supportNotes/n1': NOTE,
    'disputes/j1': DISPUTE,
  });
});

describe('support notes and disputes (dashboard-only)', () => {
  it.each(['admin', 'ops', 'support'])(
    '%s reads notes, the dispute and the open-disputes list',
    async (role) => {
      const db = staff(role);
      await assertSucceeds(getDoc(doc(db, 'jobs/j1/supportNotes/n1')));
      await assertSucceeds(
        getDocs(query(collection(db, 'jobs/j1/supportNotes'), orderBy('createdAt'))),
      );
      await assertSucceeds(getDoc(doc(db, 'disputes/j1')));
      await assertSucceeds(
        getDocs(
          query(
            collection(db, 'disputes'),
            where('status', '==', 'open'),
            orderBy('openedAt', 'desc'),
          ),
        ),
      );
    },
  );

  it("the job's own customer and mechanic cannot read them", async () => {
    for (const uid of [UID.customer, UID.mechanic]) {
      const db = appUser(uid);
      await assertSucceeds(getDoc(doc(db, 'jobs/j1'))); // they can see the job itself
      await assertFails(getDoc(doc(db, 'jobs/j1/supportNotes/n1')));
      await assertFails(getDocs(collection(db, 'jobs/j1/supportNotes')));
      await assertFails(getDoc(doc(db, 'disputes/j1')));
    }
    await assertFails(getDocs(collection(appUser(UID.otherCustomer), 'disputes')));
    await assertFails(getDoc(doc(anonymous(), 'disputes/j1')));
  });

  it.each(['admin', 'ops', 'support'])(
    '%s cannot write them directly (Cloud Functions only)',
    async (role) => {
      const db = staff(role);
      await assertFails(addDoc(collection(db, 'jobs/j1/supportNotes'), NOTE));
      await assertFails(updateDoc(doc(db, 'jobs/j1/supportNotes/n1'), { text: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'jobs/j1/supportNotes/n1')));
      await assertFails(setDoc(doc(db, 'disputes/j2'), { ...DISPUTE, jobId: 'j2' }));
      await assertFails(updateDoc(doc(db, 'disputes/j1'), { status: 'resolved' }));
    },
  );

  it('app users cannot write them either', async () => {
    const db = appUser(UID.customer);
    await assertFails(addDoc(collection(db, 'jobs/j1/supportNotes'), NOTE));
    await assertFails(setDoc(doc(db, 'disputes/j1'), DISPUTE));
  });
});

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { baseWorld, UID } from './world';

const PAYMENT = {
  id: `${UID.mechanic}_2026-10-05`,
  mechanicId: UID.mechanic,
  weekStart: '2026-10-05',
  amount: 15000,
  method: 'mobile-money',
  reference: 'MP123',
  paidAt: '2026-10-06T09:00:00.000Z',
  recordedBy: 'staff_ops',
  recordedByEmail: 'ops@autorafiki.test',
};
const path = `subscriptions/${PAYMENT.id}`;

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({ ...baseWorld(), [path]: PAYMENT });
});

describe('subscription payments (dashboard-only)', () => {
  it.each(['admin', 'ops', 'support'])('%s reads payments and the week query', async (role) => {
    const db = staff(role);
    await assertSucceeds(getDoc(doc(db, path)));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'subscriptions'),
          where('weekStart', '>=', '2026-10-05'),
          where('weekStart', '<=', '2026-10-12'),
        ),
      ),
    );
  });

  it('the mechanic who paid and other app users cannot read payments', async () => {
    await assertFails(getDoc(doc(appUser(UID.mechanic), path)));
    await assertFails(getDocs(collection(appUser(UID.customer), 'subscriptions')));
  });

  it.each(['admin', 'ops', 'support'])(
    '%s cannot write payments directly (callable only)',
    async (role) => {
      const db = staff(role);
      await assertFails(
        setDoc(doc(db, 'subscriptions/x_2026-10-12'), { ...PAYMENT, weekStart: '2026-10-12' }),
      );
      await assertFails(updateDoc(doc(db, path), { amount: 1 }));
      await assertFails(deleteDoc(doc(db, path)));
    },
  );

  it('a mechanic cannot mark themselves paid', async () => {
    await assertFails(setDoc(doc(appUser(UID.mechanic), 'subscriptions/self_2026-10-12'), PAYMENT));
  });
});

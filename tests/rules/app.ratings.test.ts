import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

import { listRatings, submitRating } from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv } from './env';
import { baseWorld, jobDoc, UID } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({
    ...baseWorld(),
    'jobs/done': jobDoc('done', 'complete'),
    'jobs/live': jobDoc('live', 'working'),
  });
});

const parties = { jobId: 'done', mechanicId: UID.mechanic, customerId: UID.customer };

describe('app path: ratings', () => {
  it('the customer rates the mechanic on a complete job (no ratedBy, as early docs)', async () => {
    await assertSucceeds(
      submitRating(appUser(UID.customer), { ...parties, stars: 5, comment: 'Fast' }),
    );
  });

  it("the customer rates with ratedBy: 'customer'", async () => {
    await assertSucceeds(
      submitRating(appUser(UID.customer), { ...parties, stars: 4, ratedBy: 'customer' }),
    );
  });

  it('the mechanic rates the customer', async () => {
    await assertSucceeds(
      submitRating(appUser(UID.mechanic), { ...parties, stars: 2, ratedBy: 'mechanic' }),
    );
  });

  it('both rating lists load for any signed-in user; anonymous cannot read', async () => {
    await submitRating(appUser(UID.customer), { ...parties, stars: 5 });
    await submitRating(appUser(UID.mechanic), { ...parties, stars: 3, ratedBy: 'mechanic' });
    await assertSucceeds(listRatings(appUser(UID.otherCustomer), 'mechanicId', UID.mechanic));
    await assertSucceeds(listRatings(appUser(UID.mechanic), 'customerId', UID.customer));
    await assertFails(listRatings(anonymous(), 'mechanicId', UID.mechanic));
  });

  it('rejects rating an unfinished job, the wrong parties, or out-of-range stars', async () => {
    const db = appUser(UID.customer);
    await assertFails(submitRating(db, { ...parties, jobId: 'live', stars: 5 }));
    await assertFails(submitRating(db, { ...parties, mechanicId: UID.otherMechanic, stars: 5 }));
    await assertFails(submitRating(db, { ...parties, stars: 0 }));
    await assertFails(submitRating(db, { ...parties, stars: 6 }));
  });

  it('rejects rating on behalf of the other side', async () => {
    await assertFails(submitRating(appUser(UID.mechanic), { ...parties, stars: 1 }));
    await assertFails(
      submitRating(appUser(UID.mechanic), { ...parties, stars: 1, ratedBy: 'customer' }),
    );
    await assertFails(
      submitRating(appUser(UID.customer), { ...parties, stars: 1, ratedBy: 'mechanic' }),
    );
    await assertFails(
      submitRating(appUser(UID.otherCustomer), {
        ...parties,
        customerId: UID.otherCustomer,
        stars: 1,
      }),
    );
  });

  it('ratings are immutable after the id write and never deleted', async () => {
    const db = appUser(UID.customer);
    const ref = await addDoc(collection(db, 'ratings'), {
      ...parties,
      stars: 5,
      createdAt: new Date().toISOString(),
    });
    await assertSucceeds(updateDoc(ref, { id: ref.id }));
    await assertFails(updateDoc(ref, { stars: 1 }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDoc(doc(appUser(UID.otherMechanic), ref.path)));
  });
});

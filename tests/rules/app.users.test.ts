import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { firstSignIn, savePushToken, setActiveRole, updateDisplayName } from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv } from './env';
import { baseWorld, PHONE, UID, userDoc } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
});

describe('app path: users/{uid} (private)', () => {
  it('first sign-in creates the user and public profile docs', async () => {
    const db = appUser('u_new', '+256772999999');
    await assertSucceeds(firstSignIn(db, 'u_new', '+256772999999'));
  });

  it('the owner reads their own user doc; nobody else can', async () => {
    await seed(baseWorld());
    await assertSucceeds(getDoc(doc(appUser(UID.customer), 'users', UID.customer)));
    await assertFails(getDoc(doc(appUser(UID.otherCustomer), 'users', UID.customer)));
    await assertFails(getDoc(doc(appUser(UID.mechanic), 'users', UID.customer)));
    await assertFails(getDoc(doc(anonymous(), 'users', UID.customer)));
  });

  it('switching mode adds the mechanic role and sets activeRole', async () => {
    await seed(baseWorld());
    const user = userDoc(UID.customer, PHONE.customer, ['customer']);
    await assertSucceeds(setActiveRole(appUser(UID.customer), user, 'mechanic'));
    await assertSucceeds(
      setActiveRole(
        appUser(UID.customer),
        { ...user, roles: ['customer', 'mechanic'] },
        'customer',
      ),
    );
  });

  it('display name and customer push token updates go through', async () => {
    await seed(baseWorld());
    const db = appUser(UID.customer);
    await assertSucceeds(updateDisplayName(db, UID.customer, 'Aisha Nakato'));
    await assertSucceeds(savePushToken(db, UID.customer, 'customer', 'fcm-token-1'));
  });

  it('rejects creating a user doc for someone else, a foreign id, or an unknown role', async () => {
    const db = appUser('u_new');
    const base = userDoc('u_new', '+256772999999', ['customer']);
    await assertFails(setDoc(doc(db, 'users', 'u_someone'), { ...base, id: 'u_someone' }));
    await assertFails(setDoc(doc(db, 'users', 'u_new'), { ...base, id: 'u_other' }));
    await assertFails(setDoc(doc(db, 'users', 'u_new'), { ...base, roles: ['customer', 'admin'] }));
  });

  it('rejects changing the id or phone, and deleting', async () => {
    await seed(baseWorld());
    const db = appUser(UID.customer);
    await assertFails(updateDoc(doc(db, 'users', UID.customer), { phone: '+256772111111' }));
    await assertFails(updateDoc(doc(db, 'users', UID.customer), { id: 'u_x' }));
    await assertFails(deleteDoc(doc(db, 'users', UID.customer)));
  });
});

describe('app path: profiles/{uid} (public)', () => {
  it('any signed-in user reads profiles; anonymous cannot', async () => {
    await seed(baseWorld());
    await assertSucceeds(getDoc(doc(appUser(UID.mechanic), 'profiles', UID.customer)));
    await assertFails(getDoc(doc(anonymous(), 'profiles', UID.customer)));
  });

  it('renaming keeps working once Cloud Functions have added rating fields', async () => {
    await seed({
      [`profiles/${UID.customer}`]: {
        id: UID.customer,
        displayName: 'A',
        ratingAverage: 4.5,
        ratingCount: 2,
      },
    });
    await seed({ [`users/${UID.customer}`]: userDoc(UID.customer, PHONE.customer, ['customer']) });
    await assertSucceeds(updateDisplayName(appUser(UID.customer), UID.customer, 'Aisha'));
  });

  it('rejects client writes to the Cloud-Function-owned rating fields', async () => {
    await seed(baseWorld());
    const db = appUser(UID.customer);
    await assertFails(updateDoc(doc(db, 'profiles', UID.customer), { ratingAverage: 5 }));
    await assertFails(
      setDoc(doc(appUser('u_new'), 'profiles', 'u_new'), {
        id: 'u_new',
        displayName: 'x',
        ratingCount: 9,
      }),
    );
  });

  it("rejects writing someone else's profile, or a name over 60 characters", async () => {
    await seed(baseWorld());
    await assertFails(
      updateDoc(doc(appUser(UID.otherCustomer), 'profiles', UID.customer), { displayName: 'x' }),
    );
    await assertFails(
      updateDoc(doc(appUser(UID.customer), 'profiles', UID.customer), {
        displayName: 'x'.repeat(61),
      }),
    );
    await assertFails(deleteDoc(doc(appUser(UID.customer), 'profiles', UID.customer)));
  });
});

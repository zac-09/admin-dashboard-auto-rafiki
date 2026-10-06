import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { findNearbyQuery, savePushToken, setOnline, updateLocation } from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv } from './env';
import { baseWorld, mechanicDoc, UID } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed(baseWorld());
});

describe('app path: mechanics/{uid}', () => {
  it('a new mechanic creates their own profile as pending', async () => {
    await assertSucceeds(
      setDoc(doc(appUser('u_new'), 'mechanics', 'u_new'), mechanicDoc('u_new', 'pending')),
    );
  });

  it('cannot self-create as verified or suspended, or for someone else', async () => {
    const db = appUser('u_new');
    await assertFails(setDoc(doc(db, 'mechanics', 'u_new'), mechanicDoc('u_new', 'verified')));
    await assertFails(setDoc(doc(db, 'mechanics', 'u_new'), mechanicDoc('u_new', 'suspended')));
    await assertFails(setDoc(doc(db, 'mechanics', 'u_x'), mechanicDoc('u_x', 'pending')));
  });

  it('the mechanic goes online/offline, publishes location and push token', async () => {
    for (const uid of [UID.mechanic, UID.pendingMechanic, UID.suspendedMechanic]) {
      const db = appUser(uid);
      await assertSucceeds(setOnline(db, uid, false));
      await assertSucceeds(setOnline(db, uid, true));
      await assertSucceeds(updateLocation(db, uid, 0.33, 32.6));
      await assertSucceeds(savePushToken(db, uid, 'mechanic', `fcm-${uid}`));
    }
  });

  it('the mechanic edits their own profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(appUser(UID.mechanic), 'mechanics', UID.mechanic), {
        businessName: 'New name',
        services: ['towing'],
        vehicles: ['truck'],
        calloutFee: 40_000,
      }),
    );
  });

  it('never lets the mechanic change vetting, in either direction', async () => {
    await assertFails(
      updateDoc(doc(appUser(UID.pendingMechanic), 'mechanics', UID.pendingMechanic), {
        vetting: 'verified',
      }),
    );
    await assertFails(
      updateDoc(doc(appUser(UID.suspendedMechanic), 'mechanics', UID.suspendedMechanic), {
        vetting: 'pending',
      }),
    );
    await assertFails(
      updateDoc(doc(appUser(UID.mechanic), 'mechanics', UID.mechanic), { vetting: 'pending' }),
    );
  });

  it("rejects editing another mechanic's profile, changing userId, and deletes", async () => {
    await assertFails(setOnline(appUser(UID.otherMechanic), UID.mechanic, false));
    await assertFails(
      updateDoc(doc(appUser(UID.mechanic), 'mechanics', UID.mechanic), { userId: 'u_x' }),
    );
    await assertFails(deleteDoc(doc(appUser(UID.mechanic), 'mechanics', UID.mechanic)));
  });

  it('any signed-in user reads mechanics and runs the findNearby query; anonymous cannot', async () => {
    await assertSucceeds(getDoc(doc(appUser(UID.customer), 'mechanics', UID.mechanic)));
    const result = await assertSucceeds(findNearbyQuery(appUser(UID.customer)));
    expect(result.docs.map((d) => d.id).sort()).toEqual([UID.mechanic, UID.otherMechanic].sort());
    await assertFails(getDoc(doc(anonymous(), 'mechanics', UID.mechanic)));
  });
});

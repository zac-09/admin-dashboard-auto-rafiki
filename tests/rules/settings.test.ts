import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { DEFAULT_APP_SETTINGS } from '../../src/lib/appSettings';

import { anonymous, appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { UID } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({ 'settings/app': DEFAULT_APP_SETTINGS, 'settings/internal': { secret: true } });
});

describe('settings/app (the app reads, the callable writes)', () => {
  it('every signed-in app user and staff role reads settings/app', async () => {
    for (const db of [
      appUser(UID.customer),
      appUser(UID.mechanic),
      staff('support'),
      staff('admin'),
    ]) {
      await assertSucceeds(getDoc(doc(db, 'settings/app')));
    }
    await assertFails(getDoc(doc(anonymous(), 'settings/app')));
  });

  it('app users cannot read other settings documents', async () => {
    await assertFails(getDoc(doc(appUser(UID.customer), 'settings/internal')));
  });

  it('nobody writes settings directly, not even admins (updateSettings only)', async () => {
    for (const db of [appUser(UID.customer), staff('admin')]) {
      await assertFails(updateDoc(doc(db, 'settings/app'), { 'prices.battery': 1000 }));
      await assertFails(setDoc(doc(db, 'settings/app'), DEFAULT_APP_SETTINGS));
      await assertFails(deleteDoc(doc(db, 'settings/app')));
      await assertFails(setDoc(doc(db, 'settings/other'), { x: 1 }));
    }
  });
});

describe('settings/billing (dashboard-only; the app gets payTo through getMySubscription)', () => {
  it('staff read it; app users never; nobody writes directly', async () => {
    await seed({ 'settings/billing': { payTo: null } });
    await assertSucceeds(getDoc(doc(staff('support'), 'settings/billing')));
    await assertFails(getDoc(doc(appUser(UID.mechanic), 'settings/billing')));
    await assertFails(setDoc(doc(staff('admin'), 'settings/billing'), { payTo: null }));
  });
});

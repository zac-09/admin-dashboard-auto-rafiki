import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { anonymous, appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { baseWorld, jobDoc, KOLOLO, UID } from './world';

/**
 * Paths agreed with the app on 2026-10-14: the availability log, the operations inbox and
 * broadcast offers; plus the existing job paths the app now also uses for the ETA and plate.
 */
beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed(baseWorld());
});

const AT = '2026-10-14T08:00:00.000Z';
const availability = (uid: string) => `mechanics/${uid}/availability`;

describe('app path: mechanics/{uid}/availability (append-only log)', () => {
  it('the mechanic logs going online, a ping and going offline, as the app writes them', async () => {
    const log = collection(appUser(UID.mechanic), availability(UID.mechanic));
    await assertSucceeds(addDoc(log, { event: 'online', at: AT, location: KOLOLO }));
    await assertSucceeds(
      addDoc(log, { event: 'ping', at: AT, location: { latitude: 0.33, longitude: 32.59 } }),
    );
    await assertSucceeds(addDoc(log, { event: 'offline', at: AT }));
    await assertSucceeds(addDoc(log, { event: 'offline', at: AT, location: KOLOLO }));
  });

  it('rejects other uids, unknown events, missing positions, extra fields and bad places', async () => {
    const mine = collection(appUser(UID.mechanic), availability(UID.mechanic));
    await assertFails(
      addDoc(collection(appUser(UID.mechanic), availability(UID.otherMechanic)), {
        event: 'online',
        at: AT,
        location: KOLOLO,
      }),
    );
    await assertFails(addDoc(mine, { event: 'busy', at: AT, location: KOLOLO }));
    await assertFails(addDoc(mine, { event: 'online', at: AT }));
    await assertFails(addDoc(mine, { event: 'ping', at: AT, location: KOLOLO, speed: 3 }));
    await assertFails(
      addDoc(mine, { event: 'ping', at: AT, location: { latitude: '0.3', longitude: 32.5 } }),
    );
    await assertFails(addDoc(mine, { event: 'offline' }));
  });

  it('entries are never edited or deleted; only staff read them', async () => {
    const path = `${availability(UID.mechanic)}/e1`;
    await setDoc(doc(appUser(UID.mechanic), path), { event: 'online', at: AT, location: KOLOLO });
    await assertFails(updateDoc(doc(appUser(UID.mechanic), path), { event: 'offline' }));
    await assertFails(deleteDoc(doc(appUser(UID.mechanic), path)));
    await assertSucceeds(getDoc(doc(staff('ops'), path)));
    await assertFails(getDoc(doc(appUser(UID.customer), path)));
    await assertFails(getDoc(doc(anonymous(), path)));
  });
});

describe('app path: mechanics/{uid}/inbox (messages from operations)', () => {
  const path = (uid: string) => `mechanics/${uid}/inbox/m1`;
  beforeEach(() =>
    seed({
      [path(UID.mechanic)]: {
        title: 'Kira needs cover tonight',
        body: 'Requests near Kira are going unanswered after 6 pm.',
        sentAt: AT,
        readAt: null,
      },
    }),
  );

  it('the mechanic lists and reads their own messages, and marks one read once', async () => {
    const db = appUser(UID.mechanic);
    await assertSucceeds(getDocs(collection(db, `mechanics/${UID.mechanic}/inbox`)));
    await assertSucceeds(getDoc(doc(db, path(UID.mechanic))));
    await assertSucceeds(updateDoc(doc(db, path(UID.mechanic)), { readAt: AT }));
    await assertFails(updateDoc(doc(db, path(UID.mechanic)), { readAt: '2026-10-15T08:00:00Z' }));
  });

  it('nobody else reads them; the mechanic cannot write, edit or delete messages', async () => {
    await assertFails(getDoc(doc(appUser(UID.otherMechanic), path(UID.mechanic))));
    await assertFails(
      getDocs(collection(appUser(UID.customer), `mechanics/${UID.mechanic}/inbox`)),
    );
    await assertFails(getDoc(doc(anonymous(), path(UID.mechanic))));
    const db = appUser(UID.mechanic);
    await assertFails(
      setDoc(doc(db, `mechanics/${UID.mechanic}/inbox/fake`), {
        title: 'x',
        body: 'y',
        sentAt: AT,
        readAt: null,
      }),
    );
    await assertFails(updateDoc(doc(db, path(UID.mechanic)), { title: 'changed' }));
    await assertFails(updateDoc(doc(db, path(UID.mechanic)), { readAt: AT, title: 'changed' }));
    await assertFails(deleteDoc(doc(db, path(UID.mechanic))));
    // Staff write through the callable only.
    await assertFails(
      setDoc(doc(staff('admin'), `mechanics/${UID.mechanic}/inbox/direct`), { title: 'x' }),
    );
    await assertSucceeds(getDoc(doc(staff('support'), path(UID.mechanic))));
  });
});

describe('app path: jobs/{jobId}/offers/{mechanicId} (who the broadcast reached)', () => {
  const offer = (mechanicId: string) => `jobs/j_open/offers/${mechanicId}`;
  beforeEach(() =>
    seed({
      'jobs/j_open': jobDoc('j_open', 'requested'),
      [offer(UID.mechanic)]: {
        mechanicId: UID.mechanic,
        distanceKm: 2.4,
        ring: { innerKm: 0, outerKm: 5 },
        sentAt: AT,
        openedAt: null,
        declinedAt: null,
      },
    }),
  );

  it('the mechanic reads their offer and records opening it, then turning it down, once each', async () => {
    const db = appUser(UID.mechanic);
    await assertSucceeds(getDoc(doc(db, offer(UID.mechanic))));
    await assertSucceeds(updateDoc(doc(db, offer(UID.mechanic)), { openedAt: AT }));
    await assertFails(
      updateDoc(doc(db, offer(UID.mechanic)), { openedAt: AT.replace('08', '09') }),
    );
    await assertSucceeds(updateDoc(doc(db, offer(UID.mechanic)), { declinedAt: AT }));
    await assertFails(
      updateDoc(doc(db, offer(UID.mechanic)), { declinedAt: AT.replace('08', '09') }),
    );
  });

  it('nobody else reads or writes offers; the mechanic cannot change the facts', async () => {
    await assertFails(getDoc(doc(appUser(UID.otherMechanic), offer(UID.mechanic))));
    await assertFails(getDoc(doc(appUser(UID.customer), offer(UID.mechanic))));
    await assertFails(getDocs(collection(appUser(UID.customer), 'jobs/j_open/offers')));
    const db = appUser(UID.mechanic);
    await assertFails(updateDoc(doc(db, offer(UID.mechanic)), { distanceKm: 0.1 }));
    await assertFails(updateDoc(doc(db, offer(UID.mechanic)), { openedAt: 5 }));
    await assertFails(
      setDoc(doc(appUser(UID.otherMechanic), offer(UID.otherMechanic)), {
        mechanicId: UID.otherMechanic,
        sentAt: AT,
      }),
    );
    await assertFails(deleteDoc(doc(db, offer(UID.mechanic))));
    await assertSucceeds(getDocs(collection(staff('ops'), 'jobs/j_open/offers')));
  });
});

describe('existing job paths the app now uses for the ETA and the plate', () => {
  it('the assigned mechanic records etaMinutes when setting off', async () => {
    await seed({ 'jobs/j_matched': jobDoc('j_matched', 'matched', { mechanicId: UID.mechanic }) });
    await assertSucceeds(
      updateDoc(doc(appUser(UID.mechanic), 'jobs/j_matched'), {
        status: 'enroute',
        etaMinutes: 14,
      }),
    );
  });

  it('a customer creates a request carrying a vehicle plate', async () => {
    const job = jobDoc('j_plate', 'requested');
    await assertSucceeds(
      setDoc(doc(appUser(UID.customer), 'jobs/j_plate'), {
        ...job,
        request: { ...job.request, vehiclePlate: 'UBA123A' },
      }),
    );
  });
});

describe('opsMessages (dashboard-only record of messages sent)', () => {
  it('staff read; app users never; nobody writes directly', async () => {
    await seed({ 'opsMessages/m1': { title: 't', body: 'b', recipientIds: [UID.mechanic] } });
    await assertSucceeds(getDoc(doc(staff('support'), 'opsMessages/m1')));
    await assertFails(getDoc(doc(appUser(UID.mechanic), 'opsMessages/m1')));
    await assertFails(setDoc(doc(staff('admin'), 'opsMessages/m2'), { title: 'x' }));
  });
});

describe('collection-group reads the dashboard makes over the app logs', () => {
  beforeEach(() =>
    seed({
      [`mechanics/${UID.mechanic}/availability/e1`]: { event: 'online', at: AT, location: KOLOLO },
      'jobs/j_open': jobDoc('j_open', 'requested'),
      [`jobs/j_open/offers/${UID.mechanic}`]: { mechanicId: UID.mechanic, sentAt: AT },
    }),
  );

  it('staff read every availability log and every offer across jobs', async () => {
    const db = staff('ops');
    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'availability'), where('at', '>=', AT))),
    );
    await assertSucceeds(getDocs(query(collectionGroup(db, 'offers'), where('sentAt', '>=', AT))));
  });

  it('app users cannot read them across the board', async () => {
    const db = appUser(UID.mechanic);
    await assertFails(getDocs(collectionGroup(db, 'availability')));
    await assertFails(getDocs(collectionGroup(db, 'offers')));
  });
});

describe('handoverNotes (dashboard-only shift notes)', () => {
  it('staff read; app users never; nobody writes directly', async () => {
    await seed({ 'handoverNotes/n1': { text: 'watch job x', handledAt: null } });
    await assertSucceeds(getDoc(doc(staff('support'), 'handoverNotes/n1')));
    await assertFails(getDoc(doc(appUser(UID.mechanic), 'handoverNotes/n1')));
    await assertFails(setDoc(doc(staff('ops'), 'handoverNotes/n2'), { text: 'x' }));
    await assertFails(updateDoc(doc(staff('admin'), 'handoverNotes/n1'), { handledAt: AT }));
  });
});

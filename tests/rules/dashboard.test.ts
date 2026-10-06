import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import {
  createRequest,
  firstSignIn,
  sendMessage,
  setOnline,
  setPresence,
  submitRating,
} from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { baseWorld, jobDoc, KOLOLO, mechanicDoc, UID } from './world';

const ROLES = ['admin', 'ops', 'support'] as const;

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed({
    ...baseWorld(),
    'jobs/j1': jobDoc('j1', 'enroute'),
    'jobs/j1/messages/m1': {
      id: 'm1',
      jobId: 'j1',
      senderId: UID.customer,
      senderRole: 'customer',
      text: 'Hi',
      createdAt: '2026-10-01T10:03:00.000Z',
    },
    'ratings/r1': {
      id: 'r1',
      jobId: 'jx',
      mechanicId: UID.mechanic,
      customerId: UID.customer,
      stars: 2,
      createdAt: '2026-10-01T11:00:00.000Z',
    },
    [`presence/${UID.customer}`]: {
      userId: UID.customer,
      online: true,
      lastSeen: new Date(),
      viewingJobId: null,
    },
    'auditLog/a1': {
      action: 'staff.bootstrap',
      actorUid: 'system',
      reason: 'bootstrap',
      at: '2026-10-01T09:00:00.000Z',
    },
  });
});

describe.each(ROLES)('dashboard role %s: reads everything', (role) => {
  it('reads private user docs, mechanics, jobs, chat, ratings, presence, profiles and the audit log', async () => {
    const db = staff(role);
    for (const path of [
      `users/${UID.customer}`,
      `mechanics/${UID.pendingMechanic}`,
      'jobs/j1',
      'jobs/j1/messages/m1',
      'ratings/r1',
      `presence/${UID.customer}`,
      `profiles/${UID.customer}`,
      'auditLog/a1',
    ]) {
      await assertSucceeds(getDoc(doc(db, path)));
    }
  });

  it('runs collection-wide queries (job board, vetting queues, search)', async () => {
    const db = staff(role);
    for (const name of ['users', 'mechanics', 'jobs', 'ratings', 'presence', 'auditLog']) {
      await assertSucceeds(getDocs(collection(db, name)));
    }
    await assertSucceeds(getDocs(collectionGroup(db, 'messages')));
  });
});

describe.each(ROLES)('dashboard role %s: no direct writes', (role) => {
  let db: Firestore;
  beforeEach(() => {
    db = staff(role);
  });

  it('cannot change vetting or any mechanic field', async () => {
    await assertFails(
      updateDoc(doc(db, 'mechanics', UID.pendingMechanic), { vetting: 'verified' }),
    );
    await assertFails(updateDoc(doc(db, 'mechanics', UID.mechanic), { vetting: 'suspended' }));
    await assertFails(updateDoc(doc(db, 'mechanics', UID.mechanic), { isOnline: false }));
  });

  it('cannot cancel, re-broadcast, reassign or delete a job', async () => {
    await assertFails(
      updateDoc(doc(db, 'jobs', 'j1'), { status: 'cancelled', cancelledBy: 'system' }),
    );
    await assertFails(
      updateDoc(doc(db, 'jobs', 'j1'), { radiusKm: 8, expiresAt: new Date().toISOString() }),
    );
    await assertFails(updateDoc(doc(db, 'jobs', 'j1'), { mechanicId: UID.otherMechanic }));
    await assertFails(deleteDoc(doc(db, 'jobs', 'j1')));
  });

  it('cannot write users, profiles, ratings, chat or presence', async () => {
    await assertFails(updateDoc(doc(db, 'users', UID.customer), { displayName: 'x' }));
    await assertFails(updateDoc(doc(db, 'profiles', UID.customer), { ratingAverage: 5 }));
    await assertFails(updateDoc(doc(db, 'ratings', 'r1'), { stars: 5 }));
    await assertFails(deleteDoc(doc(db, 'ratings', 'r1')));
    await assertFails(updateDoc(doc(db, 'jobs/j1/messages/m1'), { text: 'x' }));
  });

  it('cannot write, edit or delete the audit log', async () => {
    await assertFails(addDoc(collection(db, 'auditLog'), { action: 'staff.role.set' }));
    await assertFails(updateDoc(doc(db, 'auditLog', 'a1'), { reason: 'edited' }));
    await assertFails(deleteDoc(doc(db, 'auditLog', 'a1')));
  });

  it('cannot use the app paths as their own customer or mechanic', async () => {
    const uid = `staff_${role}`;
    await assertFails(firstSignIn(db, uid, '+256772999999'));
    await assertFails(
      createRequest(db, {
        customerId: uid,
        location: KOLOLO,
        vehicle: 'car',
        service: 'battery',
        description: '',
      }),
    );
    await assertFails(setDoc(doc(db, 'mechanics', uid), mechanicDoc(uid, 'pending')));
    await assertFails(setPresence(db, uid, { online: true, viewingJobId: null }));
    await assertFails(
      sendMessage(db, { jobId: 'j1', senderId: uid, senderRole: 'customer', text: 'x' }),
    );
  });
});

describe('population boundary', () => {
  it('app users cannot read the audit log, other users, or collection-wide lists', async () => {
    const db = appUser(UID.customer);
    await assertFails(getDoc(doc(db, 'auditLog', 'a1')));
    await assertFails(getDocs(collection(db, 'auditLog')));
    await assertFails(getDoc(doc(db, 'users', UID.otherCustomer)));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDocs(collection(db, 'jobs')));
    await assertFails(getDoc(doc(anonymous(), 'auditLog', 'a1')));
  });

  it('a token with an unknown role value gets neither staff reads nor app writes', async () => {
    const db = staff('superuser');
    await assertFails(getDoc(doc(db, 'users', UID.customer)));
    await assertFails(getDoc(doc(db, 'auditLog', 'a1')));
    await assertFails(getDoc(doc(db, 'mechanics', UID.mechanic)));
    await assertFails(setOnline(db, UID.mechanic, false));
  });

  it('app paths are untouched by staff existing: customer and mechanic still work alongside', async () => {
    await assertSucceeds(setOnline(appUser(UID.mechanic), UID.mechanic, false));
    await seed({ 'jobs/done': jobDoc('done', 'complete') });
    await assertSucceeds(
      submitRating(appUser(UID.customer), {
        jobId: 'done',
        mechanicId: UID.mechanic,
        customerId: UID.customer,
        stars: 5,
      }),
    );
  });
});

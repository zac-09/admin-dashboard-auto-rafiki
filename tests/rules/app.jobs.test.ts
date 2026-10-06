import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

import {
  acceptJob,
  createRequest,
  getJob,
  listJobsForCustomer,
  listJobsForMechanic,
  listOpenRequests,
  rebroadcast,
  updateStatus,
} from './appClient';
import { anonymous, appUser, rulesEnv, seed, setupRulesEnv } from './env';
import { baseWorld, jobDoc, KOLOLO, UID } from './world';

const REQUEST = {
  customerId: UID.customer,
  location: KOLOLO,
  vehicle: 'car' as const,
  service: 'battery' as const,
  description: 'Will not start',
};

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed(baseWorld());
});

describe('app path: job request (customer)', () => {
  it('creates a request, then stamps its id (createRequest)', async () => {
    const id = await assertSucceeds(createRequest(appUser(UID.customer), REQUEST));
    const job = await getJob(appUser(UID.customer), id);
    expect(job).toMatchObject({
      id,
      status: 'requested',
      request: { id, customerId: UID.customer },
    });
  });

  it('a mechanic-mode user can also request help as a customer', async () => {
    await assertSucceeds(
      createRequest(appUser(UID.mechanic), { ...REQUEST, customerId: UID.mechanic }),
    );
  });

  it('rejects requests for someone else, pre-matched, or pre-assigned', async () => {
    const db = appUser(UID.customer);
    await assertFails(createRequest(db, { ...REQUEST, customerId: UID.otherCustomer }));
    const base = {
      request: { ...REQUEST, createdAt: new Date().toISOString() },
      fee: 35_000,
      radiusKm: 5,
      timeline: [],
    };
    await assertFails(addDoc(collection(db, 'jobs'), { ...base, status: 'matched' }));
    await assertFails(
      addDoc(collection(db, 'jobs'), { ...base, status: 'requested', mechanicId: UID.mechanic }),
    );
    await assertFails(createRequest(anonymous(), REQUEST));
  });

  it('widens the broadcast to 8 km while open (rebroadcast)', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'requested') });
    await assertSucceeds(rebroadcast(appUser(UID.customer), 'j1', 8));
    await assertSucceeds(rebroadcast(appUser(UID.customer), 'j1', 5));
  });

  it('rejects other radii, rebroadcasting a matched job, or rebroadcasting as a non-customer', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'requested'), 'jobs/j2': jobDoc('j2', 'matched') });
    await assertFails(rebroadcast(appUser(UID.customer), 'j1', 12));
    await assertFails(rebroadcast(appUser(UID.customer), 'j2', 8));
    await assertFails(rebroadcast(appUser(UID.mechanic), 'j1', 8));
  });

  it.each(['requested', 'matched', 'enroute'] as const)('cancels from %s', async (status) => {
    await seed({ 'jobs/j1': jobDoc('j1', status) });
    await assertSucceeds(updateStatus(appUser(UID.customer), 'j1', 'cancelled', 'customer'));
  });

  it.each(['arrived', 'working', 'complete'] as const)('cannot cancel from %s', async (status) => {
    await seed({ 'jobs/j1': jobDoc('j1', status) });
    const db = appUser(UID.customer);
    await assertFails(
      updateDoc(doc(db, 'jobs', 'j1'), { status: 'cancelled', cancelledBy: 'customer' }),
    );
  });

  it('cannot advance the job or tamper with the request', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'matched') });
    const db = appUser(UID.customer);
    await assertFails(updateDoc(doc(db, 'jobs', 'j1'), { status: 'complete' }));
    await assertFails(
      updateDoc(doc(db, 'jobs', 'j1'), {
        'request.location.label': 'Elsewhere',
        status: 'cancelled',
      }),
    );
    await assertFails(updateDoc(doc(db, 'jobs', 'j1'), { fee: 1_000 }));
  });
});

describe('app path: job reads', () => {
  beforeEach(async () => {
    await seed({
      'jobs/open': jobDoc('open', 'requested'),
      'jobs/mine': jobDoc('mine', 'enroute'),
      'jobs/theirs': jobDoc('theirs', 'enroute', {
        customerId: UID.otherCustomer,
        mechanicId: UID.otherMechanic,
      }),
    });
  });

  it('the customer reads their own jobs and lists them (listJobsForCustomer)', async () => {
    const db = appUser(UID.customer);
    await assertSucceeds(getDoc(doc(db, 'jobs', 'mine')));
    const list = await assertSucceeds(listJobsForCustomer(db, UID.customer));
    expect(list.size).toBe(2);
    await assertFails(getDoc(doc(db, 'jobs', 'theirs')));
  });

  it('the assigned mechanic reads and lists their jobs (listJobsForMechanic)', async () => {
    const db = appUser(UID.mechanic);
    await assertSucceeds(getDoc(doc(db, 'jobs', 'mine')));
    const list = await assertSucceeds(listJobsForMechanic(db, UID.mechanic));
    expect(list.docs.map((d) => d.id)).toEqual(['mine']);
    await assertFails(getDoc(doc(db, 'jobs', 'theirs')));
  });

  it('a verified mechanic reads an open request; pending and suspended cannot', async () => {
    await assertSucceeds(getDoc(doc(appUser(UID.otherMechanic), 'jobs', 'open')));
    await assertFails(getDoc(doc(appUser(UID.pendingMechanic), 'jobs', 'open')));
    await assertFails(getDoc(doc(appUser(UID.suspendedMechanic), 'jobs', 'open')));
    await assertFails(getDoc(doc(appUser(UID.otherCustomer), 'jobs', 'open')));
    await assertFails(getDoc(doc(anonymous(), 'jobs', 'open')));
  });

  it('a verified mechanic lists open requests (listOpenRequests)', async () => {
    const list = await assertSucceeds(listOpenRequests(appUser(UID.otherMechanic)));
    expect(list.docs.map((d) => d.id)).toEqual(['open']);
    await assertFails(listOpenRequests(appUser(UID.pendingMechanic)));
    await assertFails(listOpenRequests(appUser(UID.customer)));
  });
});

describe('app path: matching and job progress (mechanic)', () => {
  it('a verified mechanic accepts an open request (acceptJob transaction)', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'requested') });
    await assertSucceeds(acceptJob(appUser(UID.otherMechanic), 'j1', UID.otherMechanic));
  });

  it('first accept wins: a second mechanic cannot take a matched job', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'requested') });
    await acceptJob(appUser(UID.mechanic), 'j1', UID.mechanic);
    await assertFails(acceptJob(appUser(UID.otherMechanic), 'j1', UID.otherMechanic));
  });

  it('pending or suspended mechanics cannot accept; nobody accepts their own request or for someone else', async () => {
    await seed({
      'jobs/j1': jobDoc('j1', 'requested'),
      'jobs/own': jobDoc('own', 'requested', { customerId: UID.mechanic }),
    });
    await assertFails(acceptJob(appUser(UID.pendingMechanic), 'j1', UID.pendingMechanic));
    await assertFails(acceptJob(appUser(UID.suspendedMechanic), 'j1', UID.suspendedMechanic));
    await assertFails(acceptJob(appUser(UID.mechanic), 'own', UID.mechanic));
    await assertFails(acceptJob(appUser(UID.mechanic), 'j1', UID.otherMechanic));
  });

  it('the assigned mechanic walks the job to complete and bumps jobsCompleted', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'matched') });
    const db = appUser(UID.mechanic);
    await assertSucceeds(updateStatus(db, 'j1', 'enroute', 'mechanic'));
    await assertSucceeds(updateStatus(db, 'j1', 'arrived', 'mechanic', { distanceKm: 4.2 }));
    await assertSucceeds(updateStatus(db, 'j1', 'working', 'mechanic'));
    await assertSucceeds(updateStatus(db, 'j1', 'complete', 'mechanic'));
    const job = await getJob(db, 'j1');
    expect(job?.timeline.map((t) => t.status)).toEqual([
      'requested',
      'matched',
      'enroute',
      'arrived',
      'working',
      'complete',
    ]);
    expect(job?.distanceKm).toBe(4.2);
  });

  it('the assigned mechanic can arrive straight from matched, or cancel', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'matched'), 'jobs/j2': jobDoc('j2', 'enroute') });
    await assertSucceeds(
      updateStatus(appUser(UID.mechanic), 'j1', 'arrived', 'mechanic', { distanceKm: 1 }),
    );
    await assertSucceeds(updateStatus(appUser(UID.mechanic), 'j2', 'cancelled', 'mechanic'));
  });

  it('another mechanic cannot advance the job; the mechanic cannot reassign it or edit the request', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'matched') });
    await assertFails(
      updateDoc(doc(appUser(UID.otherMechanic), 'jobs', 'j1'), { status: 'enroute' }),
    );
    await assertFails(
      updateDoc(doc(appUser(UID.mechanic), 'jobs', 'j1'), { mechanicId: UID.otherMechanic }),
    );
    await assertFails(
      updateDoc(doc(appUser(UID.mechanic), 'jobs', 'j1'), { 'request.service': 'towing' }),
    );
    await assertFails(updateDoc(doc(appUser(UID.mechanic), 'jobs', 'j1'), { status: 'paid' }));
  });

  it('nobody deletes a job', async () => {
    await seed({ 'jobs/j1': jobDoc('j1', 'complete') });
    await assertFails(deleteDoc(doc(appUser(UID.customer), 'jobs', 'j1')));
    await assertFails(deleteDoc(doc(appUser(UID.mechanic), 'jobs', 'j1')));
  });
});

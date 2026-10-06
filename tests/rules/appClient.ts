/**
 * The app's Firestore writes, ported call-for-call from the app repo's
 * src/lib/firebase/firestoreRepositories.ts and firebaseAuthRepository.ts (React Native
 * Firebase's modular API matches the web SDK's). Rules tests drive these, so "the app path
 * still works" means exactly what the app does in production.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

import { APP_CALLOUT_PRICES } from '../../src/lib/pricing';
import {
  assertTransition,
  BROADCAST,
  COLLECTIONS,
  type Job,
  type JobRequest,
  type JobStatus,
  type User,
  type UserRole,
} from '../../src/types';

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

// --- FirebaseAuthRepository -------------------------------------------------------------

/** verifyOtp for a first-time user: creates users/{uid} and profiles/{uid}. */
export async function firstSignIn(db: Firestore, uid: string, phone: User['phone']) {
  const user: User = {
    id: uid,
    phone,
    displayName: '',
    roles: ['customer'],
    activeRole: 'customer',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, COLLECTIONS.users, uid), user);
  await setDoc(doc(db, COLLECTIONS.profiles, uid), { id: uid, displayName: user.displayName });
  return user;
}

export async function setActiveRole(db: Firestore, user: User, role: UserRole) {
  const roles = user.roles.includes(role) ? user.roles : [...user.roles, role];
  await updateDoc(doc(db, COLLECTIONS.users, user.id), { roles, activeRole: role });
}

// --- FirestoreProfileRepository --------------------------------------------------------

export async function updateDisplayName(db: Firestore, uid: string, displayName: string) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), { displayName });
  await setDoc(doc(db, COLLECTIONS.profiles, uid), { id: uid, displayName }, { merge: true });
}

export async function savePushToken(db: Firestore, uid: string, role: UserRole, token: string) {
  const col = role === 'mechanic' ? COLLECTIONS.mechanics : COLLECTIONS.users;
  await updateDoc(doc(db, col, uid), { fcmToken: token });
}

// --- FirestoreMechanicRepository -------------------------------------------------------

export async function setOnline(db: Firestore, uid: string, isOnline: boolean) {
  await updateDoc(doc(db, COLLECTIONS.mechanics, uid), { isOnline });
}

export async function updateLocation(
  db: Firestore,
  uid: string,
  latitude: number,
  longitude: number,
) {
  await updateDoc(doc(db, COLLECTIONS.mechanics, uid), {
    'lastKnownLocation.latitude': latitude,
    'lastKnownLocation.longitude': longitude,
    'lastKnownLocation.label': 'Live location',
    locationUpdatedAt: new Date().toISOString(),
  });
}

export async function findNearbyQuery(db: Firestore) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.mechanics),
      where('isOnline', '==', true),
      where('vetting', '==', 'verified'),
    ),
  );
}

// --- FirestoreJobRepository ------------------------------------------------------------

export async function createRequest(
  db: Firestore,
  input: Omit<JobRequest, 'id' | 'createdAt'>,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTIONS.jobs), {
    request: stripUndefined({ ...input, createdAt: now }),
    status: 'requested',
    fee: APP_CALLOUT_PRICES[input.service],
    radiusKm: BROADCAST.initialRadiusKm,
    expiresAt: new Date(Date.now() + BROADCAST.windowMs).toISOString(),
    timeline: [{ status: 'requested', at: now }],
  });
  await updateDoc(ref, { id: ref.id, 'request.id': ref.id });
  return ref.id;
}

export async function getJob(db: Firestore, jobId: string): Promise<Job | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.jobs, jobId));
  return snapshot.exists() ? { ...(snapshot.data() as Job), id: snapshot.id } : null;
}

export async function listJobsForCustomer(db: Firestore, customerId: string) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.jobs),
      where('request.customerId', '==', customerId),
      orderBy('request.createdAt', 'desc'),
    ),
  );
}

export async function listJobsForMechanic(db: Firestore, mechanicId: string) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.jobs),
      where('mechanicId', '==', mechanicId),
      orderBy('request.createdAt', 'desc'),
    ),
  );
}

export async function listOpenRequests(db: Firestore) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.jobs),
      where('status', '==', 'requested'),
      orderBy('request.createdAt', 'desc'),
    ),
  );
}

/** updateStatus, including the mechanic's jobsCompleted bump on completion. */
export async function updateStatus(
  db: Firestore,
  jobId: string,
  status: JobStatus,
  by: UserRole,
  extra?: Pick<Job, 'distanceKm'>,
) {
  const job = await getJob(db, jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  assertTransition(job.status, status, by);
  const timeline = [...job.timeline, { status, at: new Date().toISOString() }];
  const distance = extra?.distanceKm != null ? { distanceKm: extra.distanceKm } : {};
  await updateDoc(doc(db, COLLECTIONS.jobs, jobId), {
    status,
    timeline,
    ...distance,
    ...(status === 'cancelled' ? { cancelledBy: by } : {}),
  });
  if (status === 'complete' && job.mechanicId) {
    // The app swallows a failure here; tests surface it.
    await updateDoc(doc(db, COLLECTIONS.mechanics, job.mechanicId), {
      jobsCompleted: increment(1),
    });
  }
}

/** acceptJob: first-accept-wins transaction. */
export async function acceptJob(db: Firestore, jobId: string, mechanicId: string) {
  const ref = doc(db, COLLECTIONS.jobs, jobId);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error(`Job ${jobId} not found`);
    const job = snapshot.data() as Job;
    const timeline = [
      ...job.timeline,
      { status: 'matched' as const, at: new Date().toISOString() },
    ];
    tx.update(ref, { mechanicId, status: 'matched', timeline });
  });
}

export async function rebroadcast(db: Firestore, jobId: string, radiusKm: number) {
  const expiresAt = new Date(Date.now() + BROADCAST.windowMs).toISOString();
  await updateDoc(doc(db, COLLECTIONS.jobs, jobId), { radiusKm, expiresAt });
}

// --- FirestoreRatingRepository ---------------------------------------------------------

export async function submitRating(
  db: Firestore,
  input: {
    jobId: string;
    mechanicId: string;
    customerId: string;
    stars: number;
    ratedBy?: UserRole;
    comment?: string;
  },
) {
  const ref = await addDoc(
    collection(db, COLLECTIONS.ratings),
    stripUndefined({ ...input, createdAt: new Date().toISOString() }),
  );
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function listRatings(db: Firestore, field: 'mechanicId' | 'customerId', id: string) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.ratings),
      where(field, '==', id),
      orderBy('createdAt', 'desc'),
    ),
  );
}

// --- FirestoreChatRepository -----------------------------------------------------------

export async function sendMessage(
  db: Firestore,
  input: { jobId: string; senderId: string; senderRole: UserRole; text: string },
) {
  const ref = await addDoc(collection(db, COLLECTIONS.jobs, input.jobId, COLLECTIONS.messages), {
    ...input,
    createdAt: new Date().toISOString(),
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function listMessages(db: Firestore, jobId: string) {
  return getDocs(
    query(
      collection(db, COLLECTIONS.jobs, jobId, COLLECTIONS.messages),
      orderBy('createdAt', 'asc'),
    ),
  );
}

// --- FirestorePresenceRepository -------------------------------------------------------

export async function setPresence(
  db: Firestore,
  uid: string,
  state: { online: boolean; viewingJobId: string | null },
) {
  await setDoc(
    doc(db, COLLECTIONS.presence, uid),
    {
      userId: uid,
      online: state.online,
      viewingJobId: state.viewingJobId ?? null,
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}

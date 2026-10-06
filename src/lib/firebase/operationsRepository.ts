import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
  type QuerySnapshot,
} from 'firebase/firestore';

import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/features/operations/constants';
import {
  COLLECTIONS,
  type Job,
  type MechanicDoc,
  type OperationsRepository,
  type PeopleRepository,
  type Rating,
  type Unsubscribe,
  type UserDoc,
} from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

/** Ids come from the ref: `id` is written in a second update after the app creates a job. */
const jobsOf = (s: QuerySnapshot) => s.docs.map((d) => ({ ...(d.data() as Job), id: d.id }));

export class FirestoreOperationsRepository implements OperationsRepository {
  subscribeActiveJobs(onChange: (jobs: Job[]) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.jobs), where('status', 'in', [...ACTIVE_STATUSES])),
      (s) => onChange(jobsOf(s)),
      onError,
    );
  }

  subscribeClosedJobs(
    sinceIso: string,
    onChange: (jobs: Job[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    // Uses the app's existing (status, request.createdAt desc) index.
    return onSnapshot(
      query(
        collection(db(), COLLECTIONS.jobs),
        where('status', 'in', [...CLOSED_STATUSES]),
        where('request.createdAt', '>=', sinceIso),
        orderBy('request.createdAt', 'desc'),
      ),
      (s) => onChange(jobsOf(s)),
      onError,
    );
  }

  subscribeOnlineMechanics(
    onChange: (mechanics: MechanicDoc[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.mechanics), where('isOnline', '==', true)),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as MechanicDoc), userId: d.id }))),
      onError,
    );
  }

  subscribeLowRatings(
    sinceIso: string,
    onChange: (ratings: Rating[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    // Needs the (stars, createdAt desc) index on ratings (firebase/firestore.indexes.json).
    return onSnapshot(
      query(
        collection(db(), COLLECTIONS.ratings),
        where('stars', 'in', [1, 2]),
        where('createdAt', '>=', sinceIso),
        orderBy('createdAt', 'desc'),
      ),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as Rating), id: d.id }))),
      onError,
    );
  }

  subscribeJob(
    jobId: string,
    onChange: (job: Job | null) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db(), COLLECTIONS.jobs, jobId),
      (s) => onChange(s.exists() ? { ...(s.data() as Job), id: s.id } : null),
      onError,
    );
  }
}

export class FirestorePeopleRepository implements PeopleRepository {
  async getUser(userId: string): Promise<UserDoc | null> {
    const s = await getDoc(doc(db(), COLLECTIONS.users, userId));
    return s.exists() ? { ...(s.data() as UserDoc), id: s.id } : null;
  }

  async getMechanic(userId: string): Promise<MechanicDoc | null> {
    const s = await getDoc(doc(db(), COLLECTIONS.mechanics, userId));
    return s.exists() ? { ...(s.data() as MechanicDoc), userId: s.id } : null;
  }
}

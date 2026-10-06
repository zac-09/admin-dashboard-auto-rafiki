import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import {
  COLLECTIONS,
  DISPUTES,
  SUPPORT_NOTES,
  type ChatMessage,
  type Dispute,
  type DisputeOutcome,
  type Job,
  type MechanicDoc,
  type Rating,
  type SupportNote,
  type SupportRepository,
  type UgPhone,
  type Unsubscribe,
  type UserDoc,
} from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

async function call(name: string, data: object): Promise<void> {
  try {
    await httpsCallable(getFunctions(getFirebaseApp(), env.functionsRegion), name)(data);
  } catch (error) {
    // HttpsError messages are written for operators; pass them through.
    throw new Error((error as Error).message || 'That could not be saved.', { cause: error });
  }
}

export class FirestoreSupportRepository implements SupportRepository {
  async findJob(jobId: string): Promise<Job | null> {
    // Ids never contain "/"; guard so a pasted path can't address another document.
    if (!jobId || jobId.includes('/')) return null;
    const s = await getDoc(doc(db(), COLLECTIONS.jobs, jobId));
    return s.exists() ? { ...(s.data() as Job), id: s.id } : null;
  }

  async findByPhone(phone: UgPhone) {
    const [users, mechanics] = await Promise.all([
      getDocs(query(collection(db(), COLLECTIONS.users), where('phone', '==', phone))),
      getDocs(query(collection(db(), COLLECTIONS.mechanics), where('phone', '==', phone))),
    ]);
    return {
      users: users.docs.map((d) => ({ ...(d.data() as UserDoc), id: d.id })),
      mechanics: mechanics.docs.map((d) => ({ ...(d.data() as MechanicDoc), userId: d.id })),
    };
  }

  async listMechanics(): Promise<MechanicDoc[]> {
    const s = await getDocs(collection(db(), COLLECTIONS.mechanics));
    return s.docs.map((d) => ({ ...(d.data() as MechanicDoc), userId: d.id }));
  }

  async getUser(userId: string): Promise<UserDoc | null> {
    const s = await getDoc(doc(db(), COLLECTIONS.users, userId));
    return s.exists() ? { ...(s.data() as UserDoc), id: s.id } : null;
  }

  private async jobsWhere(field: string, userId: string): Promise<Job[]> {
    // The app's own (field, request.createdAt desc) indexes.
    const s = await getDocs(
      query(
        collection(db(), COLLECTIONS.jobs),
        where(field, '==', userId),
        orderBy('request.createdAt', 'desc'),
      ),
    );
    return s.docs.map((d) => ({ ...(d.data() as Job), id: d.id }));
  }

  listJobsForCustomer(userId: string) {
    return this.jobsWhere('request.customerId', userId);
  }

  listJobsForMechanic(userId: string) {
    return this.jobsWhere('mechanicId', userId);
  }

  subscribeMessages(
    jobId: string,
    onChange: (m: ChatMessage[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.jobs, jobId, COLLECTIONS.messages), orderBy('createdAt')),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as ChatMessage), id: d.id }))),
      onError,
    );
  }

  subscribeJobRatings(
    jobId: string,
    onChange: (r: Rating[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.ratings), where('jobId', '==', jobId)),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as Rating), id: d.id }))),
      onError,
    );
  }

  subscribeNotes(
    jobId: string,
    onChange: (n: SupportNote[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.jobs, jobId, SUPPORT_NOTES), orderBy('createdAt')),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as SupportNote), id: d.id }))),
      onError,
    );
  }

  subscribeDispute(
    jobId: string,
    onChange: (d: Dispute | null) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db(), DISPUTES, jobId),
      (s) => onChange(s.exists() ? (s.data() as Dispute) : null),
      onError,
    );
  }

  subscribeOpenDisputes(
    onChange: (d: Dispute[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    // Needs the (status, openedAt desc) index on disputes (firebase/firestore.indexes.json).
    return onSnapshot(
      query(collection(db(), DISPUTES), where('status', '==', 'open'), orderBy('openedAt', 'desc')),
      (s) => onChange(s.docs.map((d) => d.data() as Dispute)),
      onError,
    );
  }

  addNote(jobId: string, text: string) {
    return call('addSupportNote', { jobId, text });
  }

  flagDispute(jobId: string, reason: string) {
    return call('flagDispute', { jobId, reason });
  }

  resolveDispute(input: { jobId: string; outcome: DisputeOutcome; note: string }) {
    return call('resolveDispute', input);
  }
}

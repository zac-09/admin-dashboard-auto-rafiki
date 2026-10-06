import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import type { DecideVettingInput, DecideVettingResult, VettingStatus } from '@/lib/vetting';
import {
  AUDIT_COLLECTION,
  COLLECTIONS,
  type AuditEntry,
  type AuditRepository,
  type MechanicDoc,
  type MechanicRepository,
  type Unsubscribe,
  type VettingRepository,
} from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

export class FirestoreMechanicRepository implements MechanicRepository {
  async listByVetting(status: VettingStatus): Promise<MechanicDoc[]> {
    const snapshot = await getDocs(
      query(collection(db(), COLLECTIONS.mechanics), where('vetting', '==', status)),
    );
    // The doc id is the uid; take it from the ref in case `userId` is ever missing.
    return snapshot.docs.map((d) => ({ ...(d.data() as MechanicDoc), userId: d.id }));
  }

  subscribe(
    userId: string,
    onChange: (mechanic: MechanicDoc | null) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db(), COLLECTIONS.mechanics, userId),
      (snapshot) =>
        onChange(snapshot.exists() ? { ...(snapshot.data() as MechanicDoc), userId } : null),
      onError,
    );
  }
}

export class FirestoreAuditRepository implements AuditRepository {
  async listMechanicEntries(): Promise<AuditEntry[]> {
    const snapshot = await getDocs(
      query(
        collection(db(), AUDIT_COLLECTION),
        where('targetType', '==', 'mechanic'),
        orderBy('at', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => ({ ...(d.data() as AuditEntry), id: d.id }));
  }
}

export class CallableVettingRepository implements VettingRepository {
  async decide(input: DecideVettingInput): Promise<DecideVettingResult> {
    const call = httpsCallable<DecideVettingInput, DecideVettingResult>(
      getFunctions(getFirebaseApp(), env.functionsRegion),
      'decideVetting',
    );
    try {
      return (await call(input)).data;
    } catch (error) {
      // HttpsError messages from the function are written for operators; pass them through.
      throw new Error((error as Error).message || 'The decision could not be saved.', {
        cause: error,
      });
    }
  }
}

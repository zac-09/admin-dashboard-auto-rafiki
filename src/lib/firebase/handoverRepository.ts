import { collection, getFirestore, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import { HANDOVER_NOTES, type HandoverNote, type HandoverRepository } from '@/types';

import { getFirebaseApp } from './app';

async function call(name: string, data: unknown, fallback: string): Promise<void> {
  try {
    await httpsCallable(getFunctions(getFirebaseApp(), env.functionsRegion), name)(data);
  } catch (error) {
    throw new Error((error as Error).message || fallback, { cause: error });
  }
}

export class FirestoreHandoverRepository implements HandoverRepository {
  subscribe(onChange: (notes: HandoverNote[]) => void, onError: (e: Error) => void) {
    return onSnapshot(
      query(
        collection(getFirestore(getFirebaseApp()), HANDOVER_NOTES),
        orderBy('at', 'desc'),
        limit(50),
      ),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as HandoverNote), id: d.id }))),
      onError,
    );
  }

  add(input: { text: string; jobId?: string | null }) {
    return call('addHandoverNote', input, 'The note could not be saved.');
  }

  markHandled(id: string) {
    return call('markHandoverHandled', { id }, 'The note could not be updated.');
  }
}

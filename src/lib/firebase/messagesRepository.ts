import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import { INBOX, OPS_MESSAGES, type Audience, type OpsMessage } from '@/lib/mechanicMessages';
import { COLLECTIONS, type MessagesRepository, type SendMessageResult } from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

export class FirebaseMessagesRepository implements MessagesRepository {
  async send(input: { title: string; body: string; audience: Audience }) {
    try {
      const call = httpsCallable<typeof input, SendMessageResult>(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'sendMechanicMessage',
      );
      return (await call(input)).data;
    } catch (error) {
      throw new Error((error as Error).message || 'The message could not be sent.', {
        cause: error,
      });
    }
  }

  async listSent(): Promise<OpsMessage[]> {
    const s = await getDocs(
      query(collection(db(), OPS_MESSAGES), orderBy('sentAt', 'desc'), limit(50)),
    );
    return s.docs.map((d) => ({ ...(d.data() as OpsMessage), id: d.id }));
  }

  async readCount(message: Pick<OpsMessage, 'id' | 'recipientIds'>): Promise<number> {
    const copies = await Promise.all(
      message.recipientIds.map((uid) =>
        getDoc(doc(db(), COLLECTIONS.mechanics, uid, INBOX, message.id)),
      ),
    );
    return copies.filter((c) => typeof c.data()?.readAt === 'string').length;
  }
}

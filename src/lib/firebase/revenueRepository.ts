import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import {
  COLLECTIONS,
  SUBSCRIPTIONS,
  type Job,
  type PaymentMethod,
  type Rating,
  type RevenueRepository,
  type SubscriptionPayment,
} from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

export class FirestoreRevenueRepository implements RevenueRepository {
  async listPayments(fromWeek: string, toWeek: string): Promise<SubscriptionPayment[]> {
    const s = await getDocs(
      query(
        collection(db(), SUBSCRIPTIONS),
        where('weekStart', '>=', fromWeek),
        where('weekStart', '<=', toWeek),
      ),
    );
    return s.docs.map((d) => ({ ...(d.data() as SubscriptionPayment), id: d.id }));
  }

  async listJobsSince(sinceIso: string): Promise<Job[]> {
    const s = await getDocs(
      query(collection(db(), COLLECTIONS.jobs), where('request.createdAt', '>=', sinceIso)),
    );
    return s.docs.map((d) => ({ ...(d.data() as Job), id: d.id }));
  }

  async listRatingsSince(sinceIso: string): Promise<Rating[]> {
    const s = await getDocs(
      query(collection(db(), COLLECTIONS.ratings), where('createdAt', '>=', sinceIso)),
    );
    return s.docs.map((d) => ({ ...(d.data() as Rating), id: d.id }));
  }

  async voidPayment(input: { paymentId: string; reason: string }): Promise<void> {
    try {
      await httpsCallable(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'voidSubscriptionPayment',
      )(input);
    } catch (error) {
      throw new Error((error as Error).message || 'The payment could not be voided.', {
        cause: error,
      });
    }
  }

  async markPaid(input: {
    mechanicId: string;
    weekStart: string;
    method: PaymentMethod;
    reference?: string;
  }): Promise<void> {
    try {
      await httpsCallable(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'markSubscriptionPaid',
      )(input);
    } catch (error) {
      throw new Error((error as Error).message || 'The payment could not be recorded.', {
        cause: error,
      });
    }
  }
}

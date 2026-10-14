import { collectionGroup, getDocs, getFirestore, query, where } from 'firebase/firestore';

import type { AvailabilityRecord, OfferRecord } from '@/features/insights/presence';
import type { AvailabilityEvent, BroadcastOffer, InsightsRepository } from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

/**
 * Collection-group reads over the app's logs. Each range filter needs the collection-group
 * index declared in firebase/firestore.indexes.json (fieldOverrides). The owning id comes from
 * the path: mechanics/{uid}/availability/{id}, jobs/{jobId}/offers/{mechanicId}.
 */
export class FirestoreInsightsRepository implements InsightsRepository {
  async listAvailabilitySince(sinceIso: string): Promise<AvailabilityRecord[]> {
    const s = await getDocs(
      query(collectionGroup(db(), 'availability'), where('at', '>=', sinceIso)),
    );
    return s.docs.flatMap((d) => {
      const mechanicId = d.ref.parent.parent?.id;
      return mechanicId ? [{ ...(d.data() as AvailabilityEvent), mechanicId }] : [];
    });
  }

  async listOffersSince(sinceIso: string): Promise<OfferRecord[]> {
    const s = await getDocs(
      query(collectionGroup(db(), 'offers'), where('sentAt', '>=', sinceIso)),
    );
    return s.docs.flatMap((d) => {
      const jobId = d.ref.parent.parent?.id;
      return jobId ? [{ ...(d.data() as BroadcastOffer), jobId }] : [];
    });
  }
}

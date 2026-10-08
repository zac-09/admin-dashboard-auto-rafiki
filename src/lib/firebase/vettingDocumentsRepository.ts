import { collection, doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getBlob, getStorage, ref } from 'firebase/storage';

import { env } from '@/lib/env';
import {
  COLLECTIONS,
  VETTING_REVIEWS,
  type LoadedFile,
  type ReviewDocumentInput,
  type Unsubscribe,
  type VettingDocType,
  type VettingDocument,
  type VettingDocumentsRepository,
  type VettingReviews,
} from '@/types';

import { getFirebaseApp } from './app';

const db = () => getFirestore(getFirebaseApp());

export class FirebaseVettingDocumentsRepository implements VettingDocumentsRepository {
  subscribeDocuments(
    mechanicId: string,
    onChange: (docs: Partial<Record<VettingDocType, VettingDocument>>) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db(), COLLECTIONS.mechanics, mechanicId, 'vettingDocuments'),
      (s) =>
        onChange(
          Object.fromEntries(s.docs.map((d) => [d.id, d.data() as VettingDocument])) as Partial<
            Record<VettingDocType, VettingDocument>
          >,
        ),
      onError,
    );
  }

  subscribeReviews(
    mechanicId: string,
    onChange: (reviews: VettingReviews) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db(), VETTING_REVIEWS, mechanicId),
      (s) => onChange((s.data() as VettingReviews | undefined) ?? {}),
      onError,
    );
  }

  /**
   * getBlob, not getDownloadURL: a download URL carries a token that works for anyone who has
   * it, while a blob is fetched under the staff member's own auth and lives only in this tab.
   */
  async loadFile(storagePath: string, contentType: string): Promise<LoadedFile> {
    const blob = await getBlob(ref(getStorage(getFirebaseApp()), storagePath));
    const url = URL.createObjectURL(blob);
    return { url, contentType, revoke: () => URL.revokeObjectURL(url) };
  }

  async review(input: ReviewDocumentInput): Promise<void> {
    try {
      await httpsCallable(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'reviewDocument',
      )(input);
    } catch (error) {
      throw new Error((error as Error).message || 'The review could not be saved.', {
        cause: error,
      });
    }
  }
}

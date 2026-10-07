import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { SETTINGS_COLLECTION, SETTINGS_DOC } from '@/lib/appSettings';
import { env } from '@/lib/env';
import type { AppSettings, SettingsRepository, Unsubscribe } from '@/types';

import { getFirebaseApp } from './app';

export class FirestoreSettingsRepository implements SettingsRepository {
  subscribe(onChange: (raw: unknown | null) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(getFirestore(getFirebaseApp()), SETTINGS_COLLECTION, SETTINGS_DOC),
      (s) => onChange(s.exists() ? s.data() : null),
      onError,
    );
  }

  async publish(settings: AppSettings, reason: string) {
    try {
      const fn = httpsCallable<object, { changes: string[] }>(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'updateSettings',
      );
      return (await fn({ settings, reason })).data;
    } catch (error) {
      throw new Error((error as Error).message || 'Settings could not be published.', {
        cause: error,
      });
    }
  }
}

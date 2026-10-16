import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { SETTINGS_COLLECTION, SETTINGS_DOC } from '@/lib/appSettings';
import { BILLING_DOC, type BillingSettings, type PayTo } from '@/lib/billing';
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

  subscribeBilling(onChange: (payTo: PayTo | null) => void, onError: (e: Error) => void) {
    return onSnapshot(
      doc(getFirestore(getFirebaseApp()), SETTINGS_COLLECTION, BILLING_DOC),
      (s) => onChange((s.data() as BillingSettings | undefined)?.payTo ?? null),
      onError,
    );
  }

  async publishBilling(payTo: unknown, reason: string) {
    try {
      await httpsCallable(
        getFunctions(getFirebaseApp(), env.functionsRegion),
        'updateBilling',
      )({ payTo, reason });
    } catch (error) {
      throw new Error((error as Error).message || 'The numbers could not be saved.', {
        cause: error,
      });
    }
  }
}

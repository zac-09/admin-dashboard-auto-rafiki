import {
  checkAppSettings,
  effectiveSettings,
  removedCatalogueIds,
  settingsChanges,
} from '@/lib/appSettings';
import { checkPayTo, type PayTo } from '@/lib/billing';
import { SERVICE_LABELS } from '@/lib/labels';
import type { AppSettings, SettingsRepository, Unsubscribe } from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';

/** Mirrors updateSettings (functions/src/updateSettings.ts). Starts unpublished (app defaults). */
export class MockSettingsRepository implements SettingsRepository {
  private doc: AppSettings | null = null;
  private listeners = new Set<(raw: unknown | null) => void>();
  private payTo: PayTo | null = null;
  private billingListeners = new Set<(payTo: PayTo | null) => void>();
  private readonly auth: MockAuthRepository;

  constructor(auth: MockAuthRepository) {
    this.auth = auth;
  }

  /** What the app would use right now (for other mocks, e.g. the broadcast window). */
  current() {
    return effectiveSettings(this.doc).settings;
  }

  subscribe(onChange: (raw: unknown | null) => void): Unsubscribe {
    this.listeners.add(onChange);
    onChange(structuredClone(this.doc));
    return () => this.listeners.delete(onChange);
  }

  async publish(settings: AppSettings, reason: string) {
    const actor = this.auth.current();
    if (actor?.role !== 'admin') throw new Error('Only admins change settings.');
    if (!reason.trim()) throw new Error('A reason is required.');
    const check = checkAppSettings(settings);
    if (!check.ok) throw new Error(Object.values(check.errors)[0]);
    const current = effectiveSettings(this.doc);
    const removed = removedCatalogueIds(current.settings.catalogue, check.settings.catalogue);
    if (removed.length > 0) {
      throw new Error(`Catalogue items cannot be removed once published (${removed.join(', ')}).`);
    }
    const changes = settingsChanges(current.settings, check.settings, SERVICE_LABELS);
    if (changes.length === 0 && current.source === 'remote') throw new Error('Nothing changed.');
    this.doc = { ...check.settings, updatedAt: new Date().toISOString(), updatedBy: actor.uid };
    this.listeners.forEach((l) => l(structuredClone(this.doc)));
    return { changes };
  }

  /** What getMySubscription would return as payTo (for other mocks and tests). */
  currentPayTo() {
    return structuredClone(this.payTo);
  }

  subscribeBilling(onChange: (payTo: PayTo | null) => void): Unsubscribe {
    this.billingListeners.add(onChange);
    onChange(structuredClone(this.payTo));
    return () => this.billingListeners.delete(onChange);
  }

  /** Mirrors updateBilling (functions/src/subscription.ts). */
  async publishBilling(payTo: unknown, reason: string) {
    if (this.auth.current()?.role !== 'admin')
      throw new Error('Only admins change payment numbers.');
    if (!reason.trim()) throw new Error('A reason is required.');
    const check = checkPayTo(payTo);
    if (!check.ok) throw new Error(Object.values(check.errors)[0]);
    if (JSON.stringify(check.payTo) === JSON.stringify(this.payTo))
      throw new Error('Nothing changed.');
    this.payTo = check.payTo;
    this.billingListeners.forEach((l) => l(structuredClone(this.payTo)));
  }
}

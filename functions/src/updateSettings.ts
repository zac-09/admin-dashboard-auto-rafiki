import { HttpsError } from 'firebase-functions/v2/https';

import { checkAppSettings, effectiveSettings, settingsChanges } from '../../src/lib/appSettings';
import { SERVICE_LABELS } from '../../src/lib/labels';
import { can } from '../../src/lib/permissions';
import { MAX_REASON } from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import type { AppSettings } from '../../src/types/domain';

import type { Caller } from './setUserRole';

export interface SettingsTx {
  /** The stored settings/app document, raw (null when it does not exist). */
  get(): Promise<unknown>;
  set(settings: AppSettings): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface SettingsDeps {
  transact(run: (tx: SettingsTx) => Promise<void>): Promise<void>;
  now(): Date;
}

/**
 * Publishes prices and broadcast values to settings/app, which the app reads live (new requests
 * use them within seconds; existing jobs keep their fee). Needs `settings.edit` (admin).
 * Validated with the app's exact rules; audited with the before and after values.
 */
export async function updateSettings(caller: Caller | null, data: unknown, deps: SettingsDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'settings.edit')) {
    throw new HttpsError('permission-denied', 'Only admins change settings.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }
  const check = checkAppSettings(input.settings);
  if (!check.ok) {
    const [field, message] = Object.entries(check.errors)[0]!;
    throw new HttpsError('invalid-argument', `${field}: ${message}`);
  }

  let changes: string[] = [];
  await deps.transact(async (tx) => {
    const current = effectiveSettings(await tx.get());
    changes = settingsChanges(current.settings, check.settings, SERVICE_LABELS);
    // Publishing the defaults for the first time is a real change: it creates the document.
    if (changes.length === 0 && current.source === 'remote') {
      throw new HttpsError('failed-precondition', 'Nothing changed.');
    }
    const at = deps.now().toISOString();
    tx.set({ ...check.settings, updatedAt: at, updatedBy: caller.uid });
    const summary = (s: AppSettings) =>
      JSON.stringify({ prices: s.prices, broadcast: s.broadcast });
    tx.audit({
      action: 'settings.update',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'settings',
      targetId: 'app',
      targetLabel: changes.length ? changes.join('; ') : 'First publish of the current values',
      before: current.source === 'remote' ? summary(current.settings) : null,
      after: summary(check.settings),
      reason,
      at,
    });
  });
  return { changes };
}

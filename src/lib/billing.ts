/**
 * Where mechanics pay the Phase-1 subscription (app contract 2026-10-16). Kept in the
 * dashboard-only settings/billing document, not settings/app: the app never reads it
 * directly, it gets `payTo` through the getMySubscription callable. Pure, shared by the
 * editor and the updateBilling Cloud Function.
 */
import type { PayToNumber, UgPhone } from '../types/domain';

export const BILLING_DOC = 'billing';
export const PAY_TO_LIMITS = { numbers: 4, name: 60, note: 160 } as const;
export const NETWORKS = ['MTN', 'Airtel'] as const;
const UG_PHONE = /^\+256\d{9}$/;

export interface PayTo {
  numbers: PayToNumber[];
  note: string | null;
}

/** settings/billing as stored. */
export interface BillingSettings {
  payTo: PayTo | null;
  updatedAt?: string;
  updatedBy?: string;
}

/** "0772 123 456" → "+256772123456" (null when it is not a Ugandan mobile number). */
export function normaliseUgPhone(raw: string): UgPhone | null {
  const digits = raw.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?256|0)?(7\d{8})$/.exec(digits);
  return m ? (`+256${m[1]}` as UgPhone) : null;
}

export type PayToCheck =
  { ok: true; payTo: PayTo | null } | { ok: false; errors: Record<string, string> };

/** No numbers at all clears payTo (the app then shows no payment details). */
export function checkPayTo(raw: unknown): PayToCheck {
  const input = (raw ?? {}) as { numbers?: unknown; note?: unknown };
  const errors: Record<string, string> = {};
  const list = Array.isArray(input.numbers) ? input.numbers : [];
  if (!Array.isArray(input.numbers) && input.numbers !== undefined) {
    errors['numbers'] = 'A list of numbers.';
  }
  if (list.length > PAY_TO_LIMITS.numbers) {
    errors['numbers'] = `At most ${PAY_TO_LIMITS.numbers} numbers.`;
  }
  const numbers: PayToNumber[] = [];
  const seen = new Set<string>();
  list.forEach((row, i) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const network = r.network as PayToNumber['network'];
    const number = typeof r.number === 'string' ? normaliseUgPhone(r.number) : null;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!NETWORKS.includes(network)) errors[`numbers.${i}.network`] = 'MTN or Airtel.';
    if (!number) errors[`numbers.${i}.number`] = 'A Ugandan mobile number.';
    else if (seen.has(number)) errors[`numbers.${i}.number`] = 'Listed twice.';
    if (number) seen.add(number);
    if (!name || name.length > PAY_TO_LIMITS.name) {
      errors[`numbers.${i}.name`] = 'The name registered on the number, up to 60 characters.';
    }
    if (number && UG_PHONE.test(number)) numbers.push({ network, number, name });
  });
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > PAY_TO_LIMITS.note) errors['note'] = `Up to ${PAY_TO_LIMITS.note} characters.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, payTo: numbers.length ? { numbers, note: note || null } : null };
}

/** "MTN +256772123456 (AutoRafiki Ltd)". */
export function payToLine(n: PayToNumber): string {
  return `${n.network} ${n.number} (${n.name})`;
}

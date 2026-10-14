/**
 * Messages from operations to mechanics (contract with the app, 2026-10-14). Pure, shared by
 * the composer's preview and the sendMechanicMessage Cloud Function, so the count the
 * operator sees is the count that gets the message.
 */
import { haversineKm } from './geo';
import type { MechanicDoc } from '../types/firestore';

/** Matches the app's InboxMessage limits (rules allow the app to read these as written). */
// 400 recipients: inbox copies + the record + the audit entry fit one 500-write batch.
export const MESSAGE_LIMITS = { title: 60, body: 500, recipients: 400 } as const;

/** Dashboard-owned record of each message sent (the inbox copies are the mechanics'). */
export const OPS_MESSAGES = 'opsMessages';
/** Sub-collection on mechanics/{uid}; the doc id is the opsMessages id. */
export const INBOX = 'inbox';
/** Android channel the app created for these pushes. */
export const OPS_MESSAGE_CHANNEL = 'ops-messages';

export type Audience =
  /** Named mechanics, any vetting status (an applicant can be messaged too). */
  | { kind: 'mechanics'; mechanicIds: string[] }
  /** Every verified mechanic. */
  | { kind: 'verified' }
  /** Verified mechanics last seen within `radiusKm` of a place. */
  | {
      kind: 'near';
      latitude: number;
      longitude: number;
      radiusKm: number;
      label: string;
    };

export const NEAR_RADII_KM = [3, 5, 10, 15] as const;

/** The mechanic fields recipient selection needs. */
export type Reachable = Pick<MechanicDoc, 'userId' | 'vetting' | 'lastKnownLocation'> & {
  businessName?: string;
  fcmToken?: string;
};

export function recipients<T extends Reachable>(mechanics: readonly T[], audience: Audience): T[] {
  switch (audience.kind) {
    case 'mechanics': {
      const ids = new Set(audience.mechanicIds);
      return mechanics.filter((m) => ids.has(m.userId));
    }
    case 'verified':
      return mechanics.filter((m) => m.vetting === 'verified');
    case 'near':
      return mechanics.filter(
        (m) =>
          m.vetting === 'verified' &&
          !!m.lastKnownLocation &&
          haversineKm(m.lastKnownLocation, audience) <= audience.radiusKm,
      );
  }
}

/** "3 named mechanics", "all verified mechanics", "verified mechanics within 5 km of Kira". */
export function audienceLabel(audience: Audience): string {
  switch (audience.kind) {
    case 'mechanics':
      return audience.mechanicIds.length === 1
        ? '1 named mechanic'
        : `${audience.mechanicIds.length} named mechanics`;
    case 'verified':
      return 'all verified mechanics';
    case 'near':
      return `verified mechanics within ${audience.radiusKm} km of ${audience.label}`;
  }
}

/** Validates raw callable input; returns the error to show, or the clean message. */
export function checkMessage(
  input: unknown,
): { ok: true; title: string; body: string; audience: Audience } | { ok: false; error: string } {
  const data = (input ?? {}) as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  if (!title) return { ok: false, error: 'A title is required.' };
  if (title.length > MESSAGE_LIMITS.title) {
    return { ok: false, error: `Keep the title to ${MESSAGE_LIMITS.title} characters.` };
  }
  if (!body) return { ok: false, error: 'A message is required.' };
  if (body.length > MESSAGE_LIMITS.body) {
    return { ok: false, error: `Keep the message to ${MESSAGE_LIMITS.body} characters.` };
  }
  const a = (data.audience ?? {}) as Record<string, unknown>;
  if (a.kind === 'verified') return { ok: true, title, body, audience: { kind: 'verified' } };
  if (a.kind === 'mechanics') {
    const ids = Array.isArray(a.mechanicIds)
      ? [
          ...new Set(
            a.mechanicIds.filter(
              (x): x is string => typeof x === 'string' && !!x && !x.includes('/'),
            ),
          ),
        ]
      : [];
    if (ids.length === 0) return { ok: false, error: 'Choose at least one mechanic.' };
    if (ids.length > MESSAGE_LIMITS.recipients) {
      return { ok: false, error: `At most ${MESSAGE_LIMITS.recipients} mechanics at once.` };
    }
    return { ok: true, title, body, audience: { kind: 'mechanics', mechanicIds: ids } };
  }
  if (a.kind === 'near') {
    const lat = Number(a.latitude);
    const lng = Number(a.longitude);
    const r = Number(a.radiusKm);
    const label = typeof a.label === 'string' ? a.label.trim().slice(0, 120) : '';
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return { ok: false, error: 'Choose a place.' };
    }
    if (!Number.isFinite(r) || r <= 0 || r > 50)
      return { ok: false, error: 'Choose a radius up to 50 km.' };
    return {
      ok: true,
      title,
      body,
      audience: {
        kind: 'near',
        latitude: lat,
        longitude: lng,
        radiusKm: r,
        label: label || 'the chosen place',
      },
    };
  }
  return { ok: false, error: 'Choose who gets the message.' };
}

/** dashboard record: opsMessages/{id}. */
export interface OpsMessage {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  audienceLabel: string;
  recipientIds: string[];
  /** Pushes FCM accepted; recipients without a token still get the inbox copy. */
  pushed: number;
  pushFailed: number;
  sentAt: string;
  sentBy: string;
  sentByEmail: string | null;
}

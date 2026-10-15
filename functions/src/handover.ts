import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import { isAdminRole } from '../../src/types/admin';
import { MAX_HANDOVER_NOTE, type HandoverNote } from '../../src/types/handover';

import type { Caller } from './setUserRole';

export interface HandoverDeps {
  add(note: Omit<HandoverNote, 'id'>): Promise<string>;
  /** Marks handled once; returns false when the note does not exist or is already handled. */
  markHandled(
    id: string,
    by: { uid: string; email: string | null; at: string },
  ): Promise<'ok' | 'missing' | 'already'>;
  now(): Date;
}

function staff(caller: Caller | null) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'handover.write')) {
    throw new HttpsError('permission-denied', 'Only dashboard staff write handover notes.');
  }
  return role;
}

/** A note for the next shift (any staff role). Not audited: the notes are their own log. */
export async function addHandoverNote(caller: Caller | null, data: unknown, deps: HandoverDeps) {
  const role = staff(caller);
  const input = (data ?? {}) as Record<string, unknown>;
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new HttpsError('invalid-argument', 'Write the note first.');
  if (text.length > MAX_HANDOVER_NOTE) {
    throw new HttpsError('invalid-argument', `Keep notes under ${MAX_HANDOVER_NOTE} characters.`);
  }
  const jobId =
    typeof input.jobId === 'string' && input.jobId.trim() && !input.jobId.includes('/')
      ? input.jobId.trim()
      : null;
  const id = await deps.add({
    text,
    jobId,
    at: deps.now().toISOString(),
    authorUid: caller!.uid,
    authorEmail: caller!.email,
    authorRole: role,
    handledAt: null,
    handledBy: null,
    handledByEmail: null,
  });
  return { id };
}

export async function markHandoverHandled(
  caller: Caller | null,
  data: unknown,
  deps: HandoverDeps,
) {
  staff(caller);
  const id = typeof (data as { id?: unknown })?.id === 'string' ? (data as { id: string }).id : '';
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', 'Which note?');
  const result = await deps.markHandled(id, {
    uid: caller!.uid,
    email: caller!.email,
    at: deps.now().toISOString(),
  });
  if (result === 'missing') throw new HttpsError('not-found', 'That note no longer exists.');
  if (result === 'already')
    throw new HttpsError('failed-precondition', 'Someone already handled it.');
  return { ok: true };
}

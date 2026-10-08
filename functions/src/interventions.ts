import { HttpsError } from 'firebase-functions/v2/https';

import { effectiveSettings } from '../../src/lib/appSettings';
import {
  canAdminCancel,
  canRebroadcast,
  isValidRebroadcastRadius,
} from '../../src/lib/interventions';
import { can } from '../../src/lib/permissions';
import { MAX_REASON } from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import type { Job, JobTimelineEntry } from '../../src/types/domain';
import type { SupportNote } from '../../src/types/support';

import type { Caller } from './setUserRole';

export type JobFields = Pick<
  Job,
  'status' | 'mechanicId' | 'radiusKm' | 'expiresAt' | 'timeline'
> & {
  label: string;
};

export interface InterventionTx {
  getJob(jobId: string): Promise<JobFields | null>;
  /** The raw settings/app document (null when absent). */
  getSettings(): Promise<unknown>;
  updateJob(jobId: string, fields: Record<string, unknown>): void;
  addNote(jobId: string, note: Omit<SupportNote, 'id'>): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface InterventionDeps {
  transact(run: (tx: InterventionTx) => Promise<void>): Promise<void>;
  now(): Date;
}

function authorize(caller: Caller | null) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'operations.intervene')) {
    throw new HttpsError('permission-denied', 'Your role cannot intervene on jobs.');
  }
  return { caller, role };
}

function parse(data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const jobId = typeof input.jobId === 'string' ? input.jobId.trim() : '';
  if (!jobId || jobId.includes('/')) throw new HttpsError('invalid-argument', 'jobId is required.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }
  return { input, jobId, reason };
}

/**
 * Cancels a job for the customer. Writes exactly what the app's own cancel writes (status,
 * timeline entry) with cancelledBy 'admin', which the app renders as "Cancelled by AutoRafiki
 * support" and pushes to both parties. Only from requested / matched / enroute.
 */
export async function cancelJob(caller: Caller | null, data: unknown, deps: InterventionDeps) {
  const { role } = authorize(caller);
  const { jobId, reason } = parse(data);
  await deps.transact(async (tx) => {
    const job = await tx.getJob(jobId);
    if (!job) throw new HttpsError('not-found', 'No job with that id.');
    if (!canAdminCancel(job.status)) {
      throw new HttpsError(
        'failed-precondition',
        `A job that is ${job.status} cannot be cancelled.`,
      );
    }
    const at = deps.now().toISOString();
    const timeline: JobTimelineEntry[] = [...job.timeline, { status: 'cancelled', at }];
    tx.updateJob(jobId, { status: 'cancelled', cancelledBy: 'admin', timeline });
    tx.addNote(jobId, {
      jobId,
      kind: 'intervention',
      text: `Cancelled by ops: ${reason}`,
      authorUid: caller!.uid,
      authorEmail: caller!.email,
      createdAt: at,
    });
    tx.audit({
      action: 'job.cancel',
      actorUid: caller!.uid,
      actorEmail: caller!.email,
      actorRole: role,
      targetType: 'job',
      targetId: jobId,
      targetLabel: job.label,
      before: job.status,
      after: 'cancelled',
      reason,
      at,
    });
  });
  return { jobId, status: 'cancelled' as const };
}

/**
 * Re-broadcasts an unaccepted request at the same or a wider radius with a fresh window from
 * settings/app. The app's onJobRebroadcast trigger then alerts the new outer band (wider) or
 * everyone in range again (same radius).
 */
export async function rebroadcastJob(caller: Caller | null, data: unknown, deps: InterventionDeps) {
  const { role } = authorize(caller);
  const { input, jobId, reason } = parse(data);
  let result = { jobId, radiusKm: 0, expiresAt: '' };
  await deps.transact(async (tx) => {
    const job = await tx.getJob(jobId);
    if (!job) throw new HttpsError('not-found', 'No job with that id.');
    const settings = effectiveSettings(await tx.getSettings()).settings;
    if (!canRebroadcast(job)) {
      throw new HttpsError(
        'failed-precondition',
        'Only a request nobody has accepted yet can be re-broadcast.',
      );
    }
    if (!isValidRebroadcastRadius(job.radiusKm, input.radiusKm)) {
      throw new HttpsError(
        'invalid-argument',
        `Choose a radius from ${job.radiusKm} to 30 km (the same or wider).`,
      );
    }
    const now = deps.now();
    const radiusKm = input.radiusKm as number;
    const expiresAt = new Date(now.getTime() + settings.broadcast.windowMs).toISOString();
    tx.updateJob(jobId, { radiusKm, expiresAt });
    const what =
      radiusKm > job.radiusKm
        ? `widened from ${job.radiusKm} km to ${radiusKm} km`
        : `renewed at ${radiusKm} km`;
    tx.addNote(jobId, {
      jobId,
      kind: 'intervention',
      text: `Broadcast ${what} by ops: ${reason}`,
      authorUid: caller!.uid,
      authorEmail: caller!.email,
      createdAt: now.toISOString(),
    });
    tx.audit({
      action: 'job.rebroadcast',
      actorUid: caller!.uid,
      actorEmail: caller!.email,
      actorRole: role,
      targetType: 'job',
      targetId: jobId,
      targetLabel: job.label,
      before: `${job.radiusKm} km`,
      after: `${radiusKm} km`,
      reason,
      at: now.toISOString(),
    });
    result = { jobId, radiusKm, expiresAt };
  });
  return result;
}

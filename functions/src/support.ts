import { HttpsError } from 'firebase-functions/v2/https';

import { can, type Permission } from '../../src/lib/permissions';
import { nextVetting, type VettingStatus } from '../../src/lib/vetting';
import { isAdminRole, type AdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import {
  DISPUTE_OUTCOMES,
  MAX_NOTE,
  type Dispute,
  type DisputeOutcome,
  type SupportNote,
} from '../../src/types/support';

import type { Caller } from './setUserRole';

/** What the support callables need from a job (read inside the transaction). */
export interface JobSnapshot {
  customerId: string;
  mechanicId: string | null;
  label: string;
}

/**
 * One Firestore transaction. Reads are async and must all happen before any write (Firestore's
 * rule); writes are buffered and land atomically.
 */
export interface SupportTx {
  getJob(jobId: string): Promise<JobSnapshot | null>;
  getDispute(jobId: string): Promise<Dispute | null>;
  getMechanic(id: string): Promise<{ vetting: VettingStatus; businessName: string } | null>;
  setDispute(jobId: string, dispute: Dispute): void;
  addNote(jobId: string, note: Omit<SupportNote, 'id'>): void;
  setVetting(mechanicId: string, vetting: VettingStatus): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface SupportDeps {
  transact(run: (tx: SupportTx) => Promise<void>): Promise<void>;
  now(): Date;
}

function requireStaff(
  caller: Caller | null,
  permission: Permission,
): { caller: Caller; role: AdminRole } {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, permission)) {
    throw new HttpsError('permission-denied', 'Your role cannot do this.');
  }
  return { caller, role };
}

function text(value: unknown, field: string, max: number): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (v.length > max)
    throw new HttpsError(
      'invalid-argument',
      `Keep ${field.toLowerCase()} under ${max} characters.`,
    );
  return v;
}

function jobIdOf(data: Record<string, unknown>): string {
  const jobId = typeof data.jobId === 'string' ? data.jobId.trim() : '';
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId is required.');
  return jobId;
}

async function requireJob(tx: SupportTx, jobId: string): Promise<JobSnapshot> {
  const job = await tx.getJob(jobId);
  if (!job) throw new HttpsError('not-found', 'No job with that id.');
  return job;
}

/** An internal note on a job. Needs `support.annotate` (every dashboard role). */
export async function addSupportNote(caller: Caller | null, data: unknown, deps: SupportDeps) {
  const { caller: who } = requireStaff(caller, 'support.annotate');
  const input = (data ?? {}) as Record<string, unknown>;
  const jobId = jobIdOf(input);
  const body = text(input.text, 'Note', MAX_NOTE);
  await deps.transact(async (tx) => {
    await requireJob(tx, jobId);
    tx.addNote(jobId, {
      jobId,
      kind: 'note',
      text: body,
      authorUid: who.uid,
      authorEmail: who.email,
      createdAt: deps.now().toISOString(),
    });
  });
  return { jobId };
}

/** Opens (or reopens) the job's dispute. Audited, and noted on the job. */
export async function flagDispute(caller: Caller | null, data: unknown, deps: SupportDeps) {
  const { caller: who, role } = requireStaff(caller, 'support.annotate');
  const input = (data ?? {}) as Record<string, unknown>;
  const jobId = jobIdOf(input);
  const reason = text(input.reason, 'Reason', MAX_NOTE);
  await deps.transact(async (tx) => {
    const job = await requireJob(tx, jobId);
    const existing = await tx.getDispute(jobId);
    if (existing?.status === 'open') {
      throw new HttpsError('failed-precondition', 'This job already has an open dispute.');
    }
    const at = deps.now().toISOString();
    tx.setDispute(jobId, {
      jobId,
      status: 'open',
      customerId: job.customerId,
      mechanicId: job.mechanicId,
      jobLabel: job.label,
      reason,
      openedBy: who.uid,
      openedByEmail: who.email,
      openedAt: at,
    });
    tx.addNote(jobId, {
      jobId,
      kind: 'dispute-opened',
      text: reason,
      authorUid: who.uid,
      authorEmail: who.email,
      createdAt: at,
    });
    tx.audit({
      action: 'job.dispute.open',
      actorUid: who.uid,
      actorEmail: who.email,
      actorRole: role,
      targetType: 'job',
      targetId: jobId,
      targetLabel: job.label,
      before: existing?.status ?? null,
      after: 'open',
      reason,
      at,
    });
  });
  return { jobId, status: 'open' as const };
}

/**
 * Resolves the job's open dispute with an outcome and a note. `mechanic-suspended` also
 * suspends the job's mechanic in the same transaction, which needs `vetting.decide` (so support
 * can resolve disputes but not suspend) and is audited as a vetting decision too.
 */
export async function resolveDispute(caller: Caller | null, data: unknown, deps: SupportDeps) {
  const { caller: who, role } = requireStaff(caller, 'support.annotate');
  const input = (data ?? {}) as Record<string, unknown>;
  const jobId = jobIdOf(input);
  if (!DISPUTE_OUTCOMES.includes(input.outcome as DisputeOutcome)) {
    throw new HttpsError('invalid-argument', 'Choose an outcome.');
  }
  const outcome = input.outcome as DisputeOutcome;
  const note = text(input.note, 'Note', MAX_NOTE);
  const suspend = outcome === 'mechanic-suspended';
  if (suspend && !can(role, 'vetting.decide')) {
    throw new HttpsError('permission-denied', 'Your role cannot suspend mechanics.');
  }

  await deps.transact(async (tx) => {
    const job = await requireJob(tx, jobId);
    const dispute = await tx.getDispute(jobId);
    if (!dispute || dispute.status !== 'open') {
      throw new HttpsError('failed-precondition', 'This job has no open dispute.');
    }
    const mechanic = suspend && job.mechanicId ? await tx.getMechanic(job.mechanicId) : null;
    if (suspend) {
      if (!job.mechanicId || !mechanic) {
        throw new HttpsError('failed-precondition', 'This job has no mechanic to suspend.');
      }
      if (!nextVetting(mechanic.vetting, 'suspend')) {
        throw new HttpsError('failed-precondition', `The mechanic is already ${mechanic.vetting}.`);
      }
    }

    const at = deps.now().toISOString();
    tx.setDispute(jobId, {
      ...dispute,
      status: 'resolved',
      resolution: {
        outcome,
        note,
        resolvedBy: who.uid,
        resolvedByEmail: who.email,
        resolvedAt: at,
      },
    });
    tx.addNote(jobId, {
      jobId,
      kind: 'dispute-resolved',
      text: note,
      authorUid: who.uid,
      authorEmail: who.email,
      createdAt: at,
    });
    tx.audit({
      action: 'job.dispute.resolve',
      actorUid: who.uid,
      actorEmail: who.email,
      actorRole: role,
      targetType: 'job',
      targetId: jobId,
      targetLabel: job.label,
      before: 'open',
      after: outcome,
      reason: note,
      at,
    });
    if (suspend && mechanic && job.mechanicId) {
      tx.setVetting(job.mechanicId, 'suspended');
      tx.audit({
        action: 'mechanic.vetting.suspend',
        actorUid: who.uid,
        actorEmail: who.email,
        actorRole: role,
        targetType: 'mechanic',
        targetId: job.mechanicId,
        targetLabel: mechanic.businessName,
        before: mechanic.vetting,
        after: 'suspended',
        reason: `Dispute on job ${jobId}: ${note}`,
        at,
      });
    }
  });
  return { jobId, status: 'resolved' as const, outcome };
}

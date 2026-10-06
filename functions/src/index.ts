/**
 * AutoRafiki dashboard Cloud Functions: codebase "admin" (firebase.json). The app repo owns
 * codebase "default" (onJobCreated, onJobStatusChanged, onMessageCreated, onRatingCreated,
 * expireStaleRequests); never deploy into it.
 *
 * - setUserRole:   admin-only callable that sets a staff member's `role` claim (audited)
 * - decideVetting: approve / reject / suspend a mechanic (admin, ops; audited)
 * - addSupportNote, flagDispute, resolveDispute: customer support on a job (all roles;
 *   suspending a mechanic as a dispute outcome needs admin or ops; audited)
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';

import { SERVICE_LABELS } from '../../src/lib/labels';
import { AUDIT_COLLECTION } from '../../src/types/audit';
import { COLLECTIONS } from '../../src/types/firestore';
import { DISPUTES, SUPPORT_NOTES, type Dispute } from '../../src/types/support';

import { decideVetting as decideVettingHandler, type VettingDeps } from './decideVetting';
import { setUserRole as setUserRoleHandler, type Caller, type RoleDeps } from './setUserRole';
import {
  addSupportNote as addSupportNoteHandler,
  flagDispute as flagDisputeHandler,
  resolveDispute as resolveDisputeHandler,
  type SupportDeps,
} from './support';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

const isAuthError = (error: unknown, code: string) =>
  (error as { code?: string })?.code === `auth/${code}`;

const roleDeps: RoleDeps = {
  async findAccount(by) {
    try {
      const user =
        'uid' in by ? await getAuth().getUser(by.uid) : await getAuth().getUserByEmail(by.email);
      return {
        uid: user.uid,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        customClaims: user.customClaims ?? {},
      };
    } catch (error) {
      if (isAuthError(error, 'user-not-found')) return null;
      throw error;
    }
  },
  setClaims: (uid, claims) => getAuth().setCustomUserClaims(uid, claims),
  revokeTokens: (uid) => getAuth().revokeRefreshTokens(uid),
  async writeAudit(entry) {
    await getFirestore().collection(AUDIT_COLLECTION).add(entry);
  },
  now: () => new Date(),
};

const vettingDeps: VettingDeps = {
  async transact(mechanicId, decide) {
    const db = getFirestore();
    const mechanicRef = db.collection(COLLECTIONS.mechanics).doc(mechanicId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(mechanicRef);
      const data = snapshot.data();
      const { vetting, audit } = decide(
        snapshot.exists && data
          ? { vetting: data.vetting, businessName: String(data.businessName ?? '') }
          : null,
      );
      // Only `vetting` is touched: the app owns every other mechanic field.
      if (vetting) tx.update(mechanicRef, { vetting });
      tx.create(db.collection(AUDIT_COLLECTION).doc(), audit);
    });
  },
  now: () => new Date(),
};

const supportDeps: SupportDeps = {
  async transact(run) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      await run({
        async getJob(jobId) {
          const snap = await tx.get(db.collection(COLLECTIONS.jobs).doc(jobId));
          const job = snap.data();
          if (!snap.exists || !job) return null;
          const service = SERVICE_LABELS[job.request?.service as keyof typeof SERVICE_LABELS];
          return {
            customerId: String(job.request?.customerId ?? ''),
            mechanicId: typeof job.mechanicId === 'string' ? job.mechanicId : null,
            label: `${service ?? 'Job'}, ${job.request?.location?.label ?? 'unknown location'}`,
          };
        },
        async getDispute(jobId) {
          const snap = await tx.get(db.collection(DISPUTES).doc(jobId));
          return snap.exists ? (snap.data() as Dispute) : null;
        },
        async getMechanic(id) {
          const snap = await tx.get(db.collection(COLLECTIONS.mechanics).doc(id));
          const m = snap.data();
          return snap.exists && m
            ? { vetting: m.vetting, businessName: String(m.businessName ?? '') }
            : null;
        },
        setDispute: (jobId, dispute) => {
          tx.set(db.collection(DISPUTES).doc(jobId), dispute);
        },
        addNote: (jobId, note) => {
          tx.create(
            db.collection(COLLECTIONS.jobs).doc(jobId).collection(SUPPORT_NOTES).doc(),
            note,
          );
        },
        // Only `vetting`: the app owns every other mechanic field.
        setVetting: (id, vetting) => {
          tx.update(db.collection(COLLECTIONS.mechanics).doc(id), { vetting });
        },
        audit: (entry) => {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

type CallableRequest = { auth?: { uid: string; token: Record<string, unknown> } };

function callerOf(request: CallableRequest): Caller | null {
  if (!request.auth) return null;
  return {
    uid: request.auth.uid,
    email: (request.auth.token.email as string | undefined) ?? null,
    role: request.auth.token.role,
  };
}

export const setUserRole = onCall((request) =>
  setUserRoleHandler(callerOf(request), request.data, roleDeps),
);

export const decideVetting = onCall((request) =>
  decideVettingHandler(callerOf(request), request.data, vettingDeps),
);

export const addSupportNote = onCall((request) =>
  addSupportNoteHandler(callerOf(request), request.data, supportDeps),
);

export const flagDispute = onCall((request) =>
  flagDisputeHandler(callerOf(request), request.data, supportDeps),
);

export const resolveDispute = onCall((request) =>
  resolveDisputeHandler(callerOf(request), request.data, supportDeps),
);

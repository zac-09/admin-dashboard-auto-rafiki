/**
 * AutoRafiki dashboard Cloud Functions: codebase "admin" (firebase.json). The app repo owns
 * codebase "default" (onJobCreated, onJobStatusChanged, onMessageCreated, onRatingCreated,
 * expireStaleRequests); never deploy into it.
 *
 * - setUserRole:   admin-only callable that sets a staff member's `role` claim (audited)
 * - listStaff, inviteStaff: admin-only staff management (invite audited)
 * - decideVetting: approve / reject / suspend a mechanic (admin, ops; audited)
 * - cancelJob, rebroadcastJob: control-room interventions (admin, ops; audited, noted)
 * - reviewDocument: verify / reject one uploaded vetting document (admin, ops; audited)
 * - updateSettings: publish prices / broadcast values the app reads (admin; audited)
 * - markSubscriptionPaid: record a mechanic's weekly UGX 15,000 (admin, ops; audited)
 * - voidSubscriptionPayment: mark a recorded payment as a mistake (admin, ops; audited)
 * - addSupportNote, flagDispute, resolveDispute: customer support on a job (all roles;
 *   suspending a mechanic as a dispute outcome needs admin or ops; audited)
 * - sendMechanicMessage: message mechanics, inbox copy + push (admin, ops; audited)
 * - addHandoverNote, markHandoverHandled: shift notes between operators (all roles)
 * - reportProblem (all roles), resolveProblemReport (admin): the team's problem reports
 * - getMySubscription: the signed-in mechanic's own subscription weeks (app; own uid only)
 * - updateBilling: the mobile money numbers mechanics pay to (admin; audited)
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';

import { SETTINGS_COLLECTION, SETTINGS_DOC } from '../../src/lib/appSettings';
import { BILLING_DOC, type BillingSettings } from '../../src/lib/billing';
import { SERVICE_LABELS } from '../../src/lib/labels';
import { INBOX, OPS_MESSAGE_CHANNEL, OPS_MESSAGES } from '../../src/lib/mechanicMessages';
import { AUDIT_COLLECTION, type AuditEntry } from '../../src/types/audit';
import { COLLECTIONS } from '../../src/types/firestore';
import { HANDOVER_NOTES } from '../../src/types/handover';
import { PROBLEM_REPORTS } from '../../src/types/problemReports';
import { SUBSCRIPTIONS, type SubscriptionPayment } from '../../src/types/subscriptions';
import { DISPUTES, SUPPORT_NOTES, type Dispute } from '../../src/types/support';
import { VETTING_REVIEWS, type VettingReviews } from '../../src/types/vettingReviews';

import { decideVetting as decideVettingHandler, type VettingDeps } from './decideVetting';
import {
  cancelJob as cancelJobHandler,
  rebroadcastJob as rebroadcastJobHandler,
  type InterventionDeps,
} from './interventions';
import {
  addHandoverNote as addHandoverHandler,
  markHandoverHandled as markHandledHandler,
  type HandoverDeps,
} from './handover';
import {
  reportProblem as reportProblemHandler,
  resolveProblemReport as resolveProblemHandler,
  type ProblemReportDeps,
} from './problemReports';
import { markSubscriptionPaid as markPaidHandler, type MarkPaidDeps } from './markPaid';
import {
  getMySubscription as getMySubscriptionHandler,
  updateBilling as updateBillingHandler,
  type BillingDeps,
  type MySubscriptionDeps,
} from './subscription';
import { sendMechanicMessage as sendMessageHandler, type MessageDeps } from './messages';
import { reviewDocument as reviewDocumentHandler, type ReviewDeps } from './reviewDocument';
import { updateSettings as updateSettingsHandler, type SettingsDeps } from './updateSettings';
import { voidSubscriptionPayment as voidPaidHandler, type VoidDeps } from './voidPaid';
import { setUserRole as setUserRoleHandler, type Caller, type RoleDeps } from './setUserRole';
import {
  inviteStaff as inviteStaffHandler,
  listStaff as listStaffHandler,
  type AuthAccount,
  type StaffDeps,
} from './staff';
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

const markPaidDeps: MarkPaidDeps = {
  async transact(run) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      await run({
        async getMechanic(id) {
          const snap = await tx.get(db.collection(COLLECTIONS.mechanics).doc(id));
          const m = snap.data();
          return snap.exists && m
            ? { userId: id, vetting: m.vetting, businessName: String(m.businessName ?? '') }
            : null;
        },
        async getVettingHistory(id) {
          const snap = await tx.get(
            db
              .collection(AUDIT_COLLECTION)
              .where('targetType', '==', 'mechanic')
              .where('targetId', '==', id),
          );
          return snap.docs.map((d) => {
            const e = d.data();
            return { action: e.action, targetId: e.targetId, at: e.at };
          });
        },
        async getPayment(id) {
          const snap = await tx.get(db.collection(SUBSCRIPTIONS).doc(id));
          return snap.exists ? (snap.data() as never) : null;
        },
        // set, not create: a voided record is replaced whole (the void fields drop away).
        createPayment: (payment) => {
          tx.set(db.collection(SUBSCRIPTIONS).doc(payment.id), payment);
        },
        audit: (entry) => {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

function toAccount(user: UserRecord): AuthAccount {
  const iso = (s?: string) => (s ? new Date(s).toISOString() : null);
  return {
    uid: user.uid,
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    displayName: user.displayName ?? null,
    customClaims: user.customClaims ?? {},
    disabled: user.disabled,
    createdAt: iso(user.metadata.creationTime),
    lastSignInAt: iso(user.metadata.lastSignInTime),
  };
}

const staffDeps: StaffDeps = {
  async listPage(pageToken) {
    const page = await getAuth().listUsers(1000, pageToken);
    return { accounts: page.users.map(toAccount), next: page.pageToken };
  },
  async findByEmail(email) {
    try {
      return toAccount(await getAuth().getUserByEmail(email));
    } catch (error) {
      if (isAuthError(error, 'user-not-found')) return null;
      throw error;
    }
  },
  async createUser({ email, displayName }) {
    // No password: the new staff member sets one through the setup link.
    return toAccount(await getAuth().createUser({ email, displayName }));
  },
  setClaims: (uid, claims) => getAuth().setCustomUserClaims(uid, claims),
  passwordSetupLink: (email) => getAuth().generatePasswordResetLink(email),
  async writeAudit(entry) {
    await getFirestore().collection(AUDIT_COLLECTION).add(entry);
  },
  now: () => new Date(),
};

const settingsDeps: SettingsDeps = {
  async transact(run) {
    const db = getFirestore();
    const ref = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC);
    await db.runTransaction(async (tx) => {
      await run({
        get: async () => (await tx.get(ref)).data() ?? null,
        set: (settings) => {
          tx.set(ref, settings);
        },
        audit: (entry) => {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

const interventionDeps: InterventionDeps = {
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
            status: job.status,
            mechanicId: typeof job.mechanicId === 'string' ? job.mechanicId : undefined,
            radiusKm: Number(job.radiusKm),
            expiresAt: String(job.expiresAt ?? ''),
            timeline: Array.isArray(job.timeline) ? job.timeline : [],
            label: `${service ?? 'Job'}, ${job.request?.location?.label ?? 'unknown location'}`,
          };
        },
        getSettings: async () =>
          (await tx.get(db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC))).data() ?? null,
        // Only the fields the app's own cancel / rebroadcast write.
        updateJob: (jobId, fields) => {
          tx.update(db.collection(COLLECTIONS.jobs).doc(jobId), fields);
        },
        addNote: (jobId, note) => {
          tx.create(
            db.collection(COLLECTIONS.jobs).doc(jobId).collection(SUPPORT_NOTES).doc(),
            note,
          );
        },
        audit: (entry) => {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

const voidDeps: VoidDeps = {
  async transact(run) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      await run({
        async getPayment(id) {
          const snap = await tx.get(db.collection(SUBSCRIPTIONS).doc(id));
          return snap.exists ? (snap.data() as never) : null;
        },
        async getBusinessName(mechanicId) {
          const snap = await tx.get(db.collection(COLLECTIONS.mechanics).doc(mechanicId));
          return String(snap.data()?.businessName ?? mechanicId);
        },
        updatePayment: (id, fields) => {
          tx.update(db.collection(SUBSCRIPTIONS).doc(id), fields);
        },
        audit: (entry) => {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

const reviewDeps: ReviewDeps = {
  async transact(run) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      await run({
        async getBusinessName(id) {
          const snap = await tx.get(db.collection(COLLECTIONS.mechanics).doc(id));
          return snap.exists ? String(snap.data()?.businessName ?? '') : null;
        },
        async getDocument(id, docType) {
          const snap = await tx.get(
            db
              .collection(COLLECTIONS.mechanics)
              .doc(id)
              .collection('vettingDocuments')
              .doc(docType),
          );
          return snap.exists ? (snap.data() as never) : null;
        },
        async getReviews(id) {
          const snap = await tx.get(db.collection(VETTING_REVIEWS).doc(id));
          return (snap.data() as VettingReviews | undefined) ?? {};
        },
        setReview: (id, docType, review) => {
          tx.set(db.collection(VETTING_REVIEWS).doc(id), { [docType]: review }, { merge: true });
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

const messageDeps: MessageDeps = {
  async listMechanics() {
    const snapshot = await getFirestore().collection(COLLECTIONS.mechanics).get();
    return snapshot.docs.map((d) => {
      const m = d.data();
      return {
        userId: d.id,
        vetting: m.vetting,
        businessName: String(m.businessName ?? ''),
        lastKnownLocation: m.lastKnownLocation,
        fcmToken: typeof m.fcmToken === 'string' ? m.fcmToken : undefined,
      };
    });
  },
  newId: () => getFirestore().collection(OPS_MESSAGES).doc().id,
  async commit({ id, record, inbox, audit }) {
    const db = getFirestore();
    const batch = db.batch();
    batch.create(db.collection(OPS_MESSAGES).doc(id), record);
    for (const { mechanicId, doc } of inbox) {
      batch.create(
        db.collection(COLLECTIONS.mechanics).doc(mechanicId).collection(INBOX).doc(id),
        doc,
      );
    }
    batch.create(db.collection(AUDIT_COLLECTION).doc(), audit);
    await batch.commit();
  },
  async push(targets, message) {
    // No FCM in the emulator suite: inbox copies are what tests check.
    if (process.env.FUNCTIONS_EMULATOR === 'true') return { sent: 0, failed: 0 };
    // Same shape as the app's own pushes (auto-rafiki functions sendToTokens), so the app
    // shows it on its "ops-messages" channel and routes a tap to the message. Dead tokens
    // are not pruned here: mechanics.fcmToken belongs to the app.
    const response = await getMessaging().sendEach(
      targets.map((t) => ({
        token: t.token,
        notification: { title: message.title, body: message.body },
        data: { type: 'ops-message', messageId: message.id, channelId: OPS_MESSAGE_CHANNEL },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: OPS_MESSAGE_CHANNEL,
            sound: 'default',
            icon: 'ic_notification',
            color: '#19C2D8',
          },
        },
      })),
    );
    return { sent: response.successCount, failed: response.failureCount };
  },
  async recordPush(id, result) {
    await getFirestore()
      .collection(OPS_MESSAGES)
      .doc(id)
      .update({ pushed: result.sent, pushFailed: result.failed });
  },
  now: () => new Date(),
};

const handoverDeps: HandoverDeps = {
  async add(note) {
    const ref = await getFirestore().collection(HANDOVER_NOTES).add(note);
    return ref.id;
  },
  async markHandled(id, by) {
    const db = getFirestore();
    const ref = db.collection(HANDOVER_NOTES).doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 'missing' as const;
      if (snap.data()?.handledAt) return 'already' as const;
      tx.update(ref, { handledAt: by.at, handledBy: by.uid, handledByEmail: by.email });
      return 'ok' as const;
    });
  },
  now: () => new Date(),
};

const problemReportDeps: ProblemReportDeps = {
  async add(report) {
    const ref = await getFirestore().collection(PROBLEM_REPORTS).add(report);
    return ref.id;
  },
  async resolve(id, by) {
    const db = getFirestore();
    const ref = db.collection(PROBLEM_REPORTS).doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 'missing' as const;
      if (snap.data()?.resolvedAt) return 'already' as const;
      tx.update(ref, { resolvedAt: by.at, resolvedBy: by.uid, resolvedByEmail: by.email });
      return 'ok' as const;
    });
  },
  now: () => new Date(),
};

const billingRef = () => getFirestore().collection(SETTINGS_COLLECTION).doc(BILLING_DOC);

const mySubscriptionDeps: MySubscriptionDeps = {
  async getMechanic(uid) {
    const snap = await getFirestore().collection(COLLECTIONS.mechanics).doc(uid).get();
    const m = snap.data();
    return snap.exists && m ? { userId: uid, vetting: m.vetting } : null;
  },
  async listDecisions(uid) {
    // Single-field equality on targetId: Firestore's automatic index covers it.
    const s = await getFirestore().collection(AUDIT_COLLECTION).where('targetId', '==', uid).get();
    return s.docs
      .map((d) => ({ ...(d.data() as AuditEntry), id: d.id }))
      .filter((e) => e.targetType === 'mechanic');
  },
  async listPayments(uid) {
    const s = await getFirestore().collection(SUBSCRIPTIONS).where('mechanicId', '==', uid).get();
    return s.docs.map((d) => ({ ...(d.data() as SubscriptionPayment), id: d.id }));
  },
  async getPayTo() {
    const snap = await billingRef().get();
    return (snap.data() as BillingSettings | undefined)?.payTo ?? null;
  },
  now: () => new Date(),
};

const billingDeps: BillingDeps = {
  async transact(run) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      await run({
        async get() {
          const snap = await tx.get(billingRef());
          return (snap.data() as BillingSettings | undefined)?.payTo ?? null;
        },
        set(payTo, at, by) {
          tx.set(billingRef(), { payTo, updatedAt: at, updatedBy: by });
        },
        audit(entry) {
          tx.create(db.collection(AUDIT_COLLECTION).doc(), entry);
        },
      });
    });
  },
  now: () => new Date(),
};

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

export const markSubscriptionPaid = onCall((request) =>
  markPaidHandler(callerOf(request), request.data, markPaidDeps),
);

export const listStaff = onCall((request) => listStaffHandler(callerOf(request), staffDeps));

export const inviteStaff = onCall((request) =>
  inviteStaffHandler(callerOf(request), request.data, staffDeps),
);

export const updateSettings = onCall((request) =>
  updateSettingsHandler(callerOf(request), request.data, settingsDeps),
);

export const cancelJob = onCall((request) =>
  cancelJobHandler(callerOf(request), request.data, interventionDeps),
);

export const rebroadcastJob = onCall((request) =>
  rebroadcastJobHandler(callerOf(request), request.data, interventionDeps),
);

export const voidSubscriptionPayment = onCall((request) =>
  voidPaidHandler(callerOf(request), request.data, voidDeps),
);

export const reviewDocument = onCall((request) =>
  reviewDocumentHandler(callerOf(request), request.data, reviewDeps),
);

export const sendMechanicMessage = onCall((request) =>
  sendMessageHandler(callerOf(request), request.data, messageDeps),
);

export const addHandoverNote = onCall((request) =>
  addHandoverHandler(callerOf(request), request.data, handoverDeps),
);

export const markHandoverHandled = onCall((request) =>
  markHandledHandler(callerOf(request), request.data, handoverDeps),
);

export const reportProblem = onCall((request) =>
  reportProblemHandler(callerOf(request), request.data, problemReportDeps),
);

export const resolveProblemReport = onCall((request) =>
  resolveProblemHandler(callerOf(request), request.data, problemReportDeps),
);

export const getMySubscription = onCall((request) =>
  getMySubscriptionHandler(callerOf(request), mySubscriptionDeps),
);

export const updateBilling = onCall((request) =>
  updateBillingHandler(callerOf(request), request.data, billingDeps),
);

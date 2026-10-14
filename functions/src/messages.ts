import { HttpsError } from 'firebase-functions/v2/https';

import {
  audienceLabel,
  checkMessage,
  MESSAGE_LIMITS,
  recipients,
  type OpsMessage,
  type Reachable,
} from '../../src/lib/mechanicMessages';
import { can } from '../../src/lib/permissions';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';

import type { Caller } from './setUserRole';

export interface PushTarget {
  mechanicId: string;
  token: string;
}

export interface MessageDeps {
  /** Every mechanic, with the fields recipient selection and push need. */
  listMechanics(): Promise<Reachable[]>;
  newId(): string;
  /**
   * One atomic write: the dashboard record, each recipient's inbox copy (same id) and the
   * audit entry. Inbox copies are exactly the contract fields.
   */
  commit(writes: {
    record: Omit<OpsMessage, 'id'>;
    id: string;
    inbox: {
      mechanicId: string;
      doc: { title: string; body: string; sentAt: string; readAt: null };
    }[];
    audit: Omit<AuditEntry, 'id'>;
  }): Promise<void>;
  /** Sends the pushes; returns how many FCM accepted and rejected. */
  push(
    targets: PushTarget[],
    message: { id: string; title: string; body: string },
  ): Promise<{ sent: number; failed: number }>;
  recordPush(id: string, result: { sent: number; failed: number }): Promise<void>;
  now(): Date;
}

/**
 * Messages mechanics from operations: an inbox copy for each (the app lists them and marks
 * them read) and a push to everyone with a token. The inbox is written before any push, so a
 * tapped notification always finds its message. Needs `mechanics.message` (admin, ops).
 */
export async function sendMechanicMessage(caller: Caller | null, data: unknown, deps: MessageDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'mechanics.message')) {
    throw new HttpsError('permission-denied', 'Your role cannot message mechanics.');
  }
  const check = checkMessage(data);
  if (!check.ok) throw new HttpsError('invalid-argument', check.error);
  const { title, body, audience } = check;

  const reached = recipients(await deps.listMechanics(), audience);
  if (reached.length === 0) {
    throw new HttpsError('failed-precondition', 'Nobody matches that audience.');
  }
  if (reached.length > MESSAGE_LIMITS.recipients) {
    throw new HttpsError(
      'failed-precondition',
      `That reaches ${reached.length} mechanics; send to at most ${MESSAGE_LIMITS.recipients} at once.`,
    );
  }

  const id = deps.newId();
  const sentAt = deps.now().toISOString();
  const label = audienceLabel(audience);
  const recipientIds = reached.map((m) => m.userId);
  await deps.commit({
    id,
    record: {
      title,
      body,
      audience,
      audienceLabel: label,
      recipientIds,
      pushed: 0,
      pushFailed: 0,
      sentAt,
      sentBy: caller.uid,
      sentByEmail: caller.email,
    },
    inbox: reached.map((m) => ({
      mechanicId: m.userId,
      doc: { title, body, sentAt, readAt: null },
    })),
    audit: {
      action: 'mechanic.message.send',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'message',
      targetId: id,
      targetLabel: `"${title}" to ${reached.length} ${reached.length === 1 ? 'mechanic' : 'mechanics'} (${label})`,
      before: null,
      after: recipientIds.join(', '),
      reason: body,
      at: sentAt,
    },
  });

  const targets = reached.flatMap((m) =>
    typeof m.fcmToken === 'string' && m.fcmToken
      ? [{ mechanicId: m.userId, token: m.fcmToken }]
      : [],
  );
  let result = { sent: 0, failed: 0 };
  if (targets.length > 0) {
    try {
      result = await deps.push(targets, { id, title, body });
    } catch {
      // The inbox copies are written; a push outage must not make the send look failed.
      result = { sent: 0, failed: targets.length };
    }
    await deps.recordPush(id, result);
  }
  return {
    id,
    recipients: reached.length,
    pushed: result.sent,
    pushFailed: result.failed,
    withoutPush: reached.length - targets.length,
  };
}

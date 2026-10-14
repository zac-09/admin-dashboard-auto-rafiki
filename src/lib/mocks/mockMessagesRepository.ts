import {
  audienceLabel,
  checkMessage,
  MESSAGE_LIMITS,
  recipients,
  type Audience,
  type OpsMessage,
} from '@/lib/mechanicMessages';
import type { MessagesRepository } from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';
import type { MockVettingStore } from './mockVettingRepositories';

/** Mirrors sendMechanicMessage (functions/src/messages.ts); pushes "reach" token holders. */
export class MockMessagesRepository implements MessagesRepository {
  private sent: OpsMessage[] = [];
  /** messageId → mechanic ids that opened it (tests can mark reads). */
  readonly reads = new Map<string, Set<string>>();
  private readonly vetting: MockVettingStore;
  private readonly auth: MockAuthRepository;

  constructor(vetting: MockVettingStore, auth: MockAuthRepository) {
    this.vetting = vetting;
    this.auth = auth;
  }

  async send(input: { title: string; body: string; audience: Audience }) {
    const actor = this.auth.current();
    if (!actor?.role || actor.role === 'support') {
      throw new Error('Your role cannot message mechanics.');
    }
    const check = checkMessage(input);
    if (!check.ok) throw new Error(check.error);
    const reached = recipients([...this.vetting.mechanics.values()], check.audience);
    if (reached.length === 0) throw new Error('Nobody matches that audience.');
    if (reached.length > MESSAGE_LIMITS.recipients) throw new Error('Too many recipients.');
    const id = `msg_mock_${this.sent.length + 1}`;
    const pushed = reached.filter((m) => m.fcmToken).length;
    const at = new Date().toISOString();
    this.sent.unshift({
      id,
      title: check.title,
      body: check.body,
      audience: check.audience,
      audienceLabel: audienceLabel(check.audience),
      recipientIds: reached.map((m) => m.userId),
      pushed,
      pushFailed: 0,
      sentAt: at,
      sentBy: actor.uid,
      sentByEmail: actor.email,
    });
    this.vetting.audit.push({
      id: `audit_mock_${this.vetting.audit.length + 1}`,
      action: 'mechanic.message.send',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'message',
      targetId: id,
      targetLabel: `"${check.title}" to ${reached.length} mechanics (${audienceLabel(check.audience)})`,
      before: null,
      after: reached.map((m) => m.userId).join(', '),
      reason: check.body,
      at,
    });
    return {
      id,
      recipients: reached.length,
      pushed,
      pushFailed: 0,
      withoutPush: reached.length - pushed,
    };
  }

  async listSent() {
    return structuredClone(this.sent);
  }

  async readCount(message: Pick<OpsMessage, 'id' | 'recipientIds'>) {
    const read = this.reads.get(message.id) ?? new Set();
    return message.recipientIds.filter((id) => read.has(id)).length;
  }
}

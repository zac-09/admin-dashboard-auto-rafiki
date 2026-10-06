import { SERVICE_LABELS } from '@/lib/labels';
import { nextVetting } from '@/lib/vetting';
import type {
  ChatMessage,
  Dispute,
  DisputeOutcome,
  Job,
  MechanicDoc,
  Rating,
  SupportNote,
  SupportRepository,
  UgPhone,
  Unsubscribe,
  UserDoc,
} from '@/types';

import { MESSAGES, shiftIso, USERS } from './contractFixtures';
import type { MockAuthRepository } from './mockAuthRepository';
import type { MockOperationsStore } from './mockOperationsRepository';
import type { MockVettingStore } from './mockVettingRepositories';
import { DISPUTES_FIXTURE, NOTES_FIXTURE } from './supportFixtures';

const newestFirst = (a: Job, b: Job) => b.request.createdAt.localeCompare(a.request.createdAt);

/** Mirrors the support callables' rules (functions/src/support.ts) over the shared mock stores. */
export class MockSupportRepository implements SupportRepository {
  private notes: SupportNote[];
  private disputes: Map<string, Dispute>;
  private messages: ChatMessage[];
  private listeners = new Set<() => void>();
  private readonly ops: MockOperationsStore;
  private readonly vetting: MockVettingStore;
  private readonly auth: MockAuthRepository;

  constructor(ops: MockOperationsStore, vetting: MockVettingStore, auth: MockAuthRepository) {
    this.ops = ops;
    this.vetting = vetting;
    this.auth = auth;
    const shift = (iso: string) => shiftIso(iso, ops.offset);
    this.notes = NOTES_FIXTURE.map((n, i) => ({
      ...n,
      id: `note_${i + 1}`,
      createdAt: shift(n.createdAt),
    }));
    this.disputes = new Map(
      DISPUTES_FIXTURE.map((d) => [
        d.jobId,
        { ...structuredClone(d), openedAt: shift(d.openedAt) },
      ]),
    );
    this.messages = MESSAGES.map((m) => ({ ...m, createdAt: shift(m.createdAt) }));
  }

  private watch(emit: () => void): Unsubscribe {
    this.listeners.add(emit);
    const stopOps = this.ops.listen(emit); // emits once immediately
    return () => {
      this.listeners.delete(emit);
      stopOps();
    };
  }

  private changed() {
    this.listeners.forEach((l) => l());
  }

  private actor() {
    const a = this.auth.current();
    if (!a?.role) throw new Error('Your role cannot do this.');
    return a;
  }

  private jobLabel(job: Job) {
    return `${SERVICE_LABELS[job.request.service]}, ${job.request.location.label}`;
  }

  async findJob(jobId: string) {
    return structuredClone(this.ops.jobs.get(jobId) ?? null);
  }

  async findByPhone(phone: UgPhone) {
    return {
      users: USERS.filter((u) => u.phone === phone).map((u) => structuredClone(u)),
      mechanics: [...this.vetting.mechanics.values()].filter((m) => m.phone === phone),
    };
  }

  async listMechanics(): Promise<MechanicDoc[]> {
    return [...this.vetting.mechanics.values()].map((m) => structuredClone(m));
  }

  async getUser(userId: string): Promise<UserDoc | null> {
    return structuredClone(USERS.find((u) => u.id === userId) ?? null);
  }

  async listJobsForCustomer(userId: string) {
    return [...this.ops.jobs.values()]
      .filter((j) => j.request.customerId === userId)
      .sort(newestFirst);
  }

  async listJobsForMechanic(userId: string) {
    return [...this.ops.jobs.values()].filter((j) => j.mechanicId === userId).sort(newestFirst);
  }

  subscribeMessages(jobId: string, onChange: (m: ChatMessage[]) => void): Unsubscribe {
    return this.watch(() => onChange(this.messages.filter((m) => m.jobId === jobId)));
  }

  subscribeJobRatings(jobId: string, onChange: (r: Rating[]) => void): Unsubscribe {
    return this.watch(() => onChange(this.ops.ratings.filter((r) => r.jobId === jobId)));
  }

  subscribeNotes(jobId: string, onChange: (n: SupportNote[]) => void): Unsubscribe {
    return this.watch(() =>
      onChange(this.notes.filter((n) => n.jobId === jobId).map((n) => structuredClone(n))),
    );
  }

  subscribeDispute(jobId: string, onChange: (d: Dispute | null) => void): Unsubscribe {
    return this.watch(() => onChange(structuredClone(this.disputes.get(jobId) ?? null)));
  }

  subscribeOpenDisputes(onChange: (d: Dispute[]) => void): Unsubscribe {
    return this.watch(() =>
      onChange(
        [...this.disputes.values()]
          .filter((d) => d.status === 'open')
          .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
          .map((d) => structuredClone(d)),
      ),
    );
  }

  private note(jobId: string, kind: SupportNote['kind'], text: string) {
    const a = this.actor();
    this.notes.push({
      id: `note_${this.notes.length + 1}`,
      jobId,
      kind,
      text,
      authorUid: a.uid,
      authorEmail: a.email,
      createdAt: new Date().toISOString(),
    });
  }

  async addNote(jobId: string, text: string) {
    this.actor();
    if (!this.ops.jobs.has(jobId)) throw new Error('No job with that id.');
    if (!text.trim()) throw new Error('Note is required.');
    this.note(jobId, 'note', text.trim());
    this.changed();
  }

  async flagDispute(jobId: string, reason: string) {
    const a = this.actor();
    const job = this.ops.jobs.get(jobId);
    if (!job) throw new Error('No job with that id.');
    if (this.disputes.get(jobId)?.status === 'open') {
      throw new Error('This job already has an open dispute.');
    }
    this.disputes.set(jobId, {
      jobId,
      status: 'open',
      customerId: job.request.customerId,
      mechanicId: job.mechanicId ?? null,
      jobLabel: this.jobLabel(job),
      reason: reason.trim(),
      openedBy: a.uid,
      openedByEmail: a.email,
      openedAt: new Date().toISOString(),
    });
    this.note(jobId, 'dispute-opened', reason.trim());
    this.changed();
  }

  async resolveDispute({
    jobId,
    outcome,
    note,
  }: {
    jobId: string;
    outcome: DisputeOutcome;
    note: string;
  }) {
    const a = this.actor();
    const dispute = this.disputes.get(jobId);
    if (!dispute || dispute.status !== 'open') throw new Error('This job has no open dispute.');
    if (outcome === 'mechanic-suspended') {
      if (a.role === 'support') throw new Error('Your role cannot suspend mechanics.');
      const mechanic = dispute.mechanicId ? this.vetting.mechanics.get(dispute.mechanicId) : null;
      if (!mechanic) throw new Error('This job has no mechanic to suspend.');
      if (!nextVetting(mechanic.vetting, 'suspend')) {
        throw new Error(`The mechanic is already ${mechanic.vetting}.`);
      }
      this.vetting.setVetting(mechanic.userId, 'suspended');
      this.vetting.audit.push({
        id: `audit_mock_${this.vetting.audit.length + 1}`,
        action: 'mechanic.vetting.suspend',
        actorUid: a.uid,
        actorEmail: a.email,
        actorRole: a.role!,
        targetType: 'mechanic',
        targetId: mechanic.userId,
        targetLabel: mechanic.businessName,
        before: mechanic.vetting,
        after: 'suspended',
        reason: `Dispute on job ${jobId}: ${note.trim()}`,
        at: new Date().toISOString(),
      });
    }
    this.disputes.set(jobId, {
      ...dispute,
      status: 'resolved',
      resolution: {
        outcome,
        note: note.trim(),
        resolvedBy: a.uid,
        resolvedByEmail: a.email,
        resolvedAt: new Date().toISOString(),
      },
    });
    this.note(jobId, 'dispute-resolved', note.trim());
    this.changed();
  }
}

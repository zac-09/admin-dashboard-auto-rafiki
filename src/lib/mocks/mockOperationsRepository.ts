import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/features/operations/constants';
import { SERVICE_LABELS } from '@/lib/labels';
import { canAdminCancel, canRebroadcast, isValidRebroadcastRadius } from '@/lib/interventions';
import type {
  AppSettings,
  AuditEntry,
  FeedMeta,
  Job,
  MechanicDoc,
  OperationsRepository,
  PeopleRepository,
  Rating,
  SupportNote,
  Unsubscribe,
  UserDoc,
} from '@/types';

import { FIXTURE_NOW, JOBS, RATINGS, shiftIso, shiftJob, USERS } from './contractFixtures';
import type { MockVettingStore } from './mockVettingRepositories';

type Listener = () => void;

/** In-memory jobs and ratings with change notification, so tests can drive "live" updates. */
export class MockOperationsStore {
  jobs = new Map<string, Job>();
  ratings: Rating[];
  private listeners = new Set<Listener>();

  /** How far fixture times were moved so FIXTURE_NOW reads as "now". */
  readonly offset: number;

  constructor(now: Date = new Date()) {
    const offset = now.getTime() - FIXTURE_NOW.getTime();
    this.offset = offset;
    for (const job of JOBS) this.jobs.set(job.id, shiftJob(structuredClone(job), offset));
    this.ratings = RATINGS.map((r) => ({ ...r, createdAt: shiftIso(r.createdAt, offset) }));
  }

  /** Insert or replace a job and notify every live subscription (like a Firestore write). */
  putJob(job: Job): void {
    this.jobs.set(job.id, structuredClone(job));
    this.listeners.forEach((l) => l());
  }

  listen(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  }
}

const newestFirst = (a: Job, b: Job) => b.request.createdAt.localeCompare(a.request.createdAt);

/** What the mock interventions need from the other mocks (session, notes, settings). */
export interface MockInterventionLinks {
  actor: () => { uid: string; email: string; role: AuditEntry['actorRole'] | null } | null;
  addNote: (note: Omit<SupportNote, 'id'>) => void;
  settings: () => AppSettings;
}

export class MockOperationsRepository implements OperationsRepository {
  private readonly store: MockOperationsStore;
  private readonly vetting: MockVettingStore;
  private readonly links: MockInterventionLinks;
  constructor(store: MockOperationsStore, vetting: MockVettingStore, links: MockInterventionLinks) {
    this.store = store;
    this.vetting = vetting;
    this.links = links;
  }

  /** Mirrors cancelJob / rebroadcastJob (functions/src/interventions.ts). */
  private intervene(jobId: string, reason: string) {
    const actor = this.links.actor();
    if (!actor?.role || actor.role === 'support' || actor.role === 'system') {
      throw new Error('Your role cannot intervene on jobs.');
    }
    if (!reason.trim()) throw new Error('A reason is required.');
    const job = this.store.jobs.get(jobId);
    if (!job) throw new Error('No job with that id.');
    const record = (
      action: 'job.cancel' | 'job.rebroadcast',
      before: string,
      after: string,
      note: string,
    ) => {
      const at = new Date().toISOString();
      this.vetting.audit.push({
        id: `audit_mock_${this.vetting.audit.length + 1}`,
        action,
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.role!,
        targetType: 'job',
        targetId: jobId,
        targetLabel: `${SERVICE_LABELS[job.request.service]}, ${job.request.location.label}`,
        before,
        after,
        reason: reason.trim(),
        at,
      });
      this.links.addNote({
        jobId,
        kind: 'intervention',
        text: note,
        authorUid: actor.uid,
        authorEmail: actor.email,
        createdAt: at,
      });
    };
    return { job, record };
  }

  async cancelJob(jobId: string, reason: string) {
    const { job, record } = this.intervene(jobId, reason);
    if (!canAdminCancel(job.status))
      throw new Error(`A job that is ${job.status} cannot be cancelled.`);
    const at = new Date().toISOString();
    this.store.putJob({
      ...job,
      status: 'cancelled',
      cancelledBy: 'admin',
      timeline: [...job.timeline, { status: 'cancelled', at }],
    });
    record('job.cancel', job.status, 'cancelled', `Cancelled by ops: ${reason.trim()}`);
  }

  async rebroadcastJob(jobId: string, radiusKm: number, reason: string) {
    const { job, record } = this.intervene(jobId, reason);
    if (!canRebroadcast(job))
      throw new Error('Only a request nobody has accepted yet can be re-broadcast.');
    if (!isValidRebroadcastRadius(job.radiusKm, radiusKm)) {
      throw new Error(`Choose a radius from ${job.radiusKm} to 30 km (the same or wider).`);
    }
    const expiresAt = new Date(Date.now() + this.links.settings().broadcast.windowMs).toISOString();
    this.store.putJob({ ...job, radiusKm, expiresAt });
    const what =
      radiusKm > job.radiusKm
        ? `widened from ${job.radiusKm} km to ${radiusKm} km`
        : `renewed at ${radiusKm} km`;
    record(
      'job.rebroadcast',
      `${job.radiusKm} km`,
      `${radiusKm} km`,
      `Broadcast ${what} by ops: ${reason.trim()}`,
    );
  }

  subscribeActiveJobs(onChange: (jobs: Job[], meta: FeedMeta) => void): Unsubscribe {
    return this.store.listen(() =>
      onChange(
        [...this.store.jobs.values()]
          .filter((j) => ACTIVE_STATUSES.includes(j.status))
          .sort(newestFirst),
        { fromCache: false },
      ),
    );
  }

  subscribeClosedJobs(sinceIso: string, onChange: (jobs: Job[]) => void): Unsubscribe {
    return this.store.listen(() =>
      onChange(
        [...this.store.jobs.values()]
          .filter((j) => CLOSED_STATUSES.includes(j.status) && j.request.createdAt >= sinceIso)
          .sort(newestFirst),
      ),
    );
  }

  subscribeOnlineMechanics(onChange: (m: MechanicDoc[]) => void): Unsubscribe {
    // Vetting decisions made in the mock show up here too (same store as the vetting pages).
    onChange([...this.vetting.mechanics.values()].filter((m) => m.isOnline));
    return () => undefined;
  }

  subscribeLowRatings(sinceIso: string, onChange: (r: Rating[]) => void): Unsubscribe {
    return this.store.listen(() =>
      onChange(
        this.store.ratings
          .filter((r) => r.stars <= 2 && r.createdAt >= sinceIso)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    );
  }

  subscribeJob(jobId: string, onChange: (job: Job | null) => void): Unsubscribe {
    return this.store.listen(() => onChange(structuredClone(this.store.jobs.get(jobId) ?? null)));
  }
}

export class MockPeopleRepository implements PeopleRepository {
  private readonly vetting: MockVettingStore;
  constructor(vetting: MockVettingStore) {
    this.vetting = vetting;
  }

  async getUser(userId: string): Promise<UserDoc | null> {
    return structuredClone(USERS.find((u) => u.id === userId) ?? null);
  }

  async getMechanic(userId: string): Promise<MechanicDoc | null> {
    return structuredClone(this.vetting.mechanics.get(userId) ?? null);
  }
}

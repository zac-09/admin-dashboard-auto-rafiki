import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/features/operations/constants';
import type {
  Job,
  MechanicDoc,
  OperationsRepository,
  PeopleRepository,
  Rating,
  Unsubscribe,
  UserDoc,
} from '@/types';

import { FIXTURE_NOW, JOBS, RATINGS, USERS } from './contractFixtures';
import type { MockVettingStore } from './mockVettingRepositories';

/** Moves fixture timestamps so FIXTURE_NOW becomes "now": elapsed times then look real. */
function shiftIso(iso: string, offsetMs: number): string {
  return new Date(new Date(iso).getTime() + offsetMs).toISOString();
}

function shiftJob(job: Job, offsetMs: number): Job {
  return {
    ...job,
    expiresAt: shiftIso(job.expiresAt, offsetMs),
    request: { ...job.request, createdAt: shiftIso(job.request.createdAt, offsetMs) },
    timeline: job.timeline.map((t) => ({ ...t, at: shiftIso(t.at, offsetMs) })),
  };
}

type Listener = () => void;

/** In-memory jobs and ratings with change notification, so tests can drive "live" updates. */
export class MockOperationsStore {
  jobs = new Map<string, Job>();
  ratings: Rating[];
  private listeners = new Set<Listener>();

  constructor(now: Date = new Date()) {
    const offset = now.getTime() - FIXTURE_NOW.getTime();
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

export class MockOperationsRepository implements OperationsRepository {
  private readonly store: MockOperationsStore;
  private readonly vetting: MockVettingStore;
  constructor(store: MockOperationsStore, vetting: MockVettingStore) {
    this.store = store;
    this.vetting = vetting;
  }

  subscribeActiveJobs(onChange: (jobs: Job[]) => void): Unsubscribe {
    return this.store.listen(() =>
      onChange(
        [...this.store.jobs.values()]
          .filter((j) => ACTIVE_STATUSES.includes(j.status))
          .sort(newestFirst),
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

import type { DecideVettingInput, DecideVettingResult, VettingStatus } from '../lib/vetting';

import type { AdminSession } from './admin';
import type { AuditEntry } from './audit';
import type { Job, Rating } from './domain';
import type { MechanicDoc, UserDoc } from './firestore';

/**
 * Every screen and hook talks to these interfaces only. `lib/mocks` implements them with
 * fixtures; `lib/firebase` implements them with the Firebase JS SDK. The UI never imports
 * either implementation directly: use `getRepositories()` / `useRepositories()`.
 */

export type Unsubscribe = () => void;

export interface AuthRepository {
  /** Email + password sign-in (staff never use phone OTP). */
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Emits the current session immediately (or once known), then on every change. */
  subscribe(onChange: (session: AdminSession | null) => void): Unsubscribe;
}

export interface MechanicRepository {
  /** One-shot read of a vetting queue (not live: verified mechanics stream location updates). */
  listByVetting(status: VettingStatus): Promise<MechanicDoc[]>;
  /** Live profile for the detail page; null when the doc does not exist. */
  subscribe(
    userId: string,
    onChange: (mechanic: MechanicDoc | null) => void,
    onError: (error: Error) => void,
  ): Unsubscribe;
}

export interface AuditRepository {
  /** Every audit entry about a mechanic, newest first. */
  listMechanicEntries(): Promise<AuditEntry[]>;
}

export interface VettingRepository {
  /** The `decideVetting` callable: the only way vetting changes. */
  decide(input: DecideVettingInput): Promise<DecideVettingResult>;
}

/** `fromCache`: the feed is showing cached data because the server is unreachable. */
export interface FeedMeta {
  fromCache: boolean;
}

/** Live feeds for the control room. Every subscription emits the full current list. */
export interface OperationsRepository {
  /** Jobs not yet complete or cancelled (board + map). */
  subscribeActiveJobs(
    onChange: (jobs: Job[], meta: FeedMeta) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  /** Complete and cancelled jobs requested since `sinceIso` (the board's closed columns). */
  subscribeClosedJobs(
    sinceIso: string,
    onChange: (jobs: Job[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  /** Mechanics with isOnline (any vetting status) for the map. */
  subscribeOnlineMechanics(
    onChange: (mechanics: MechanicDoc[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  /** Ratings of 1 or 2 stars (either direction) since `sinceIso` (alert rail). */
  subscribeLowRatings(
    sinceIso: string,
    onChange: (ratings: Rating[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  subscribeJob(
    jobId: string,
    onChange: (job: Job | null) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
}

export interface PeopleRepository {
  /** users/{uid}: private to app users, readable by staff (phone for support calls). */
  getUser(userId: string): Promise<UserDoc | null>;
  getMechanic(userId: string): Promise<MechanicDoc | null>;
}

export interface Repositories {
  auth: AuthRepository;
  mechanics: MechanicRepository;
  audit: AuditRepository;
  vetting: VettingRepository;
  operations: OperationsRepository;
  people: PeopleRepository;
}

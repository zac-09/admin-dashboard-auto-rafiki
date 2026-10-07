import type { DecideVettingInput, DecideVettingResult, VettingStatus } from '../lib/vetting';

import type { AdminSession } from './admin';
import type { AuditEntry } from './audit';
import type { AppSettings, ChatMessage, Job, Rating, UgPhone } from './domain';
import type { MechanicDoc, UserDoc } from './firestore';
import type { AdminRole } from './admin';
import type { InviteStaffInput, InviteStaffResult, StaffMember } from './staff';
import type { PaymentMethod, SubscriptionPayment } from './subscriptions';
import type { Dispute, DisputeOutcome, SupportNote } from './support';

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

/** Customer support: search, a job's full record, notes and disputes. */
export interface SupportRepository {
  findJob(jobId: string): Promise<Job | null>;
  /** Exact E.164 match on users and mechanics (both store `phone`). */
  findByPhone(phone: UgPhone): Promise<{ users: UserDoc[]; mechanics: MechanicDoc[] }>;
  /** Every mechanic, for business-name search in the browser (fine at pilot scale). */
  listMechanics(): Promise<MechanicDoc[]>;
  getUser(userId: string): Promise<UserDoc | null>;
  listJobsForCustomer(userId: string): Promise<Job[]>;
  listJobsForMechanic(userId: string): Promise<Job[]>;
  subscribeMessages(
    jobId: string,
    onChange: (messages: ChatMessage[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  subscribeJobRatings(
    jobId: string,
    onChange: (ratings: Rating[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  subscribeNotes(
    jobId: string,
    onChange: (notes: SupportNote[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  subscribeDispute(
    jobId: string,
    onChange: (dispute: Dispute | null) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  subscribeOpenDisputes(
    onChange: (disputes: Dispute[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  /** The audited callables. */
  addNote(jobId: string, text: string): Promise<void>;
  flagDispute(jobId: string, reason: string): Promise<void>;
  resolveDispute(input: { jobId: string; outcome: DisputeOutcome; note: string }): Promise<void>;
}

/** Phase-1 subscriptions and the KPI inputs. One-shot reads (react-query), not live. */
export interface RevenueRepository {
  /** Payments for weeks `fromWeek`..`toWeek` (Monday dates, inclusive). */
  listPayments(fromWeek: string, toWeek: string): Promise<SubscriptionPayment[]>;
  /** Jobs requested at or after `sinceIso`. */
  listJobsSince(sinceIso: string): Promise<Job[]>;
  listRatingsSince(sinceIso: string): Promise<Rating[]>;
  /** The audited markSubscriptionPaid callable. */
  markPaid(input: {
    mechanicId: string;
    weekStart: string;
    method: PaymentMethod;
    reference?: string;
  }): Promise<void>;
}

/** Dashboard accounts (admin only): Auth via callables, never Firestore. */
export interface StaffRepository {
  list(): Promise<StaffMember[]>;
  invite(input: InviteStaffInput): Promise<InviteStaffResult>;
  /** setUserRole: null removes dashboard access. */
  setRole(input: { uid: string; role: AdminRole | null; reason: string }): Promise<void>;
}

/** settings/app: live read of the raw document (null when absent) and the audited publish. */
export interface SettingsRepository {
  subscribe(onChange: (raw: unknown | null) => void, onError: (e: Error) => void): Unsubscribe;
  publish(settings: AppSettings, reason: string): Promise<{ changes: string[] }>;
}

export interface Repositories {
  auth: AuthRepository;
  mechanics: MechanicRepository;
  audit: AuditRepository;
  vetting: VettingRepository;
  operations: OperationsRepository;
  people: PeopleRepository;
  support: SupportRepository;
  revenue: RevenueRepository;
  staff: StaffRepository;
  settings: SettingsRepository;
}

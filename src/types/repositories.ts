import type { DecideVettingInput, DecideVettingResult, VettingStatus } from '../lib/vetting';

import type { AdminSession } from './admin';
import type { AuditEntry } from './audit';
import type { MechanicDoc } from './firestore';

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

export interface Repositories {
  auth: AuthRepository;
  mechanics: MechanicRepository;
  audit: AuditRepository;
  vetting: VettingRepository;
}

import type { AdminSession } from './admin';

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

export interface Repositories {
  auth: AuthRepository;
}

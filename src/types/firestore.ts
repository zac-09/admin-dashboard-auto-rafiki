import type { Job, MechanicProfile, User } from './domain';

/**
 * Firestore document shapes where they differ from the app's domain types: fields the app
 * writes (see its src/lib/firebase/*) but its TypeScript types omit. Read-side only: the
 * dashboard never writes these fields.
 */

/** Firestore collection names, mirroring the app's src/lib/firebase/collections.ts. */
export const COLLECTIONS = {
  users: 'users',
  profiles: 'profiles',
  mechanics: 'mechanics',
  jobs: 'jobs',
  ratings: 'ratings',
  presence: 'presence',
  /** Subcollection under jobs/{jobId}. */
  messages: 'messages',
} as const;

/** users/{uid}. `fcmToken` is the customer push token (ProfileRepository.savePushToken). */
export interface UserDoc extends User {
  fcmToken?: string;
}

/** mechanics/{uid}. The app also stamps `locationUpdatedAt` with every position update. */
export interface MechanicDoc extends MechanicProfile {
  fcmToken?: string;
  locationUpdatedAt?: string;
}

/**
 * jobs/{jobId}. `id` and `request.id` are written in a second update right after creation,
 * so a snapshot can briefly lack them: always take the id from the document ref.
 */
export type JobDoc = Omit<Job, 'id'> & { id?: string };

/**
 * presence/{uid} as stored: `lastSeen` is a Firestore server Timestamp (the only non-ISO
 * date in the model). Repositories convert it to the domain `Presence` (ISO string).
 */
export interface PresenceDoc {
  userId: string;
  online: boolean;
  lastSeen: { toDate(): Date } | null;
  viewingJobId: string | null;
}

/** An `online` presence older than this is stale (the app's heartbeat has stopped). */
export const PRESENCE_STALE_MS = 75_000;

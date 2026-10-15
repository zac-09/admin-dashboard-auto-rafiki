import type { AdminRole } from './admin';

/** handoverNotes/{id}: shift notes between operators (dashboard-only, written by callables). */
export const HANDOVER_NOTES = 'handoverNotes';
export const MAX_HANDOVER_NOTE = 1000;

export interface HandoverNote {
  id: string;
  text: string;
  /** A job the note is about, if any. */
  jobId: string | null;
  at: string;
  authorUid: string;
  authorEmail: string | null;
  authorRole: AdminRole;
  /** Set once when someone deals with it; never unset. */
  handledAt: string | null;
  handledBy: string | null;
  handledByEmail: string | null;
}

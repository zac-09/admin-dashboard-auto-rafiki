import { median } from '@/features/revenue/kpis';
import { documentsSummary, type DocumentsSummary } from '@/lib/vettingDocuments';
import type {
  AuditEntry,
  MechanicDoc,
  VettingDocType,
  VettingDocument,
  VettingReviews,
} from '@/types';

const DAY_MS = 86_400_000;

/** What stands between an applicant and a decision, in the order ops works them. */
export type PipelineStage =
  /** A required document is missing or was rejected: the applicant has to act. */
  | 'needs-documents'
  /** Everything is uploaded; some of it waits for a review: ops has to act. */
  | 'to-review'
  /** Every required document verified: book the practical assessment. */
  | 'ready';

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'needs-documents': 'Waiting on the applicant',
  'to-review': 'Documents to review',
  ready: 'Ready for the practical assessment',
};

export interface Applicant {
  mechanic: MechanicDoc;
  stage: PipelineStage;
  summary: DocumentsSummary;
  /** Whole days since the application (null for profiles the app stamped no createdAt on). */
  daysWaiting: number | null;
}

export function stageOf(summary: DocumentsSummary): PipelineStage {
  if (summary.missing.length || summary.rejected.length) return 'needs-documents';
  if (summary.pending.length) return 'to-review';
  return 'ready';
}

export function applicants(
  pending: readonly MechanicDoc[],
  standing: ReadonlyMap<
    string,
    { docs: Partial<Record<VettingDocType, VettingDocument>>; reviews: VettingReviews }
  >,
  now: Date,
): Applicant[] {
  return pending
    .map((mechanic) => {
      const s = standing.get(mechanic.userId) ?? { docs: {}, reviews: {} };
      const summary = documentsSummary(mechanic.vehicles, s.docs, s.reviews);
      return {
        mechanic,
        summary,
        stage: stageOf(summary),
        daysWaiting: mechanic.createdAt
          ? Math.max(0, Math.floor((now.getTime() - Date.parse(mechanic.createdAt)) / DAY_MS))
          : null,
      };
    })
    .sort((a, b) => (b.daysWaiting ?? -1) - (a.daysWaiting ?? -1));
}

/**
 * Days from application to first approval, over approvals in the last `windowDays` days.
 * Only first approvals (from pending) of mechanics whose application date is known.
 */
export function daysToApprove(
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  now: Date,
  windowDays = 90,
): { median: number | null; count: number } {
  const applied = new Map(mechanics.flatMap((m) => (m.createdAt ? [[m.userId, m.createdAt]] : [])));
  const since = now.getTime() - windowDays * DAY_MS;
  const days = entries.flatMap((e) => {
    const from = applied.get(e.targetId);
    if (e.action !== 'mechanic.vetting.approve' || e.before !== 'pending' || !from) return [];
    if (Date.parse(e.at) < since) return [];
    return [(Date.parse(e.at) - Date.parse(from)) / DAY_MS];
  });
  return { median: median(days), count: days.length };
}

/** Document names mid-sentence ("your national ID"). */
const IN_SENTENCE: Record<VettingDocType, string> = {
  'national-id': 'national ID',
  certification: 'mechanic certification',
  'riding-permit': 'riding permit',
};

/** "national ID and riding permit". */
function listDocs(types: readonly VettingDocType[]): string {
  const names = types.map((t) => IN_SENTENCE[t]);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** A nudge for an applicant who has to upload (or re-upload) documents. */
export function applicantNudge(a: Applicant): string {
  const parts: string[] = [];
  if (a.summary.missing.length) parts.push(`upload your ${listDocs(a.summary.missing)}`);
  if (a.summary.rejected.length) {
    parts.push(`upload a clearer copy of your ${listDocs(a.summary.rejected)}`);
  }
  return (
    `Hello ${a.mechanic.businessName}, this is AutoRafiki. ` +
    `To finish your mechanic application, please ${parts.join(' and ')} in the AutoRafiki app. ` +
    'Reply here if you need help. Thank you.'
  );
}

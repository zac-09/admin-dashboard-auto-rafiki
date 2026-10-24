import type { AdminRole } from './admin';

/**
 * problemReports/{id}: what staff report with "Report a problem" (dashboard-only, written by
 * the reportProblem and resolveProblemReport callables; app users never read it).
 */
export const PROBLEM_REPORTS = 'problemReports';
export const MAX_PROBLEM_REPORT = 2000;

/** Captured by the browser when the report is sent, so nobody has to describe their setup. */
export interface ProblemContext {
  /** Path and query of the page, e.g. /jobs/job_123. */
  path: string;
  /** The browser tab title at the time. */
  pageTitle: string;
  userAgent: string;
  /** Window size, "1440×900". */
  viewport: string;
  theme: 'light' | 'dark';
}

export interface ProblemReport {
  id: string;
  description: string;
  context: ProblemContext;
  at: string;
  reporterUid: string;
  reporterEmail: string | null;
  reporterRole: AdminRole;
  /** Set once when an admin has dealt with it. */
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByEmail: string | null;
}

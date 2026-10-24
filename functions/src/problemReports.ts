import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import { isAdminRole } from '../../src/types/admin';
import {
  MAX_PROBLEM_REPORT,
  type ProblemContext,
  type ProblemReport,
} from '../../src/types/problemReports';

import type { Caller } from './setUserRole';

export interface ProblemReportDeps {
  add(report: Omit<ProblemReport, 'id'>): Promise<string>;
  resolve(
    id: string,
    by: { uid: string; email: string | null; at: string },
  ): Promise<'ok' | 'missing' | 'already'>;
  now(): Date;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Context comes from the browser: keep only the known fields, as short strings. */
function cleanContext(raw: unknown): ProblemContext {
  const c = (raw ?? {}) as Record<string, unknown>;
  const path = text(c.path, 300);
  return {
    path: path.startsWith('/') ? path : '/',
    pageTitle: text(c.pageTitle, 200),
    userAgent: text(c.userAgent, 400),
    viewport: text(c.viewport, 20),
    theme: c.theme === 'dark' ? 'dark' : 'light',
  };
}

/** Any staff role reports a problem with the dashboard. Not audited: reports are their own log. */
export async function reportProblem(caller: Caller | null, data: unknown, deps: ProblemReportDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!isAdminRole(caller.role)) {
    throw new HttpsError('permission-denied', 'Only dashboard staff report problems here.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) throw new HttpsError('invalid-argument', 'Describe what went wrong first.');
  if (description.length > MAX_PROBLEM_REPORT) {
    throw new HttpsError('invalid-argument', `Keep it under ${MAX_PROBLEM_REPORT} characters.`);
  }
  const id = await deps.add({
    description,
    context: cleanContext(input.context),
    at: deps.now().toISOString(),
    reporterUid: caller.uid,
    reporterEmail: caller.email,
    reporterRole: caller.role,
    resolvedAt: null,
    resolvedBy: null,
    resolvedByEmail: null,
  });
  return { id };
}

/** Admins mark a report dealt with, once. */
export async function resolveProblemReport(
  caller: Caller | null,
  data: unknown,
  deps: ProblemReportDeps,
) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!isAdminRole(caller.role) || !can(caller.role, 'problems.manage')) {
    throw new HttpsError('permission-denied', 'Only admins resolve problem reports.');
  }
  const id = typeof (data as { id?: unknown })?.id === 'string' ? (data as { id: string }).id : '';
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', 'Which report?');
  const result = await deps.resolve(id, {
    uid: caller.uid,
    email: caller.email,
    at: deps.now().toISOString(),
  });
  if (result === 'missing') throw new HttpsError('not-found', 'That report no longer exists.');
  if (result === 'already') {
    throw new HttpsError('failed-precondition', 'Someone already resolved it.');
  }
  return { ok: true };
}

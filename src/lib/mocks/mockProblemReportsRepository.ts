import { can } from '@/lib/permissions';
import type { ProblemContext, ProblemReport, ProblemReportsRepository, Unsubscribe } from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';

/** Mirrors reportProblem / resolveProblemReport (functions/src/problemReports.ts). */
export class MockProblemReportsRepository implements ProblemReportsRepository {
  private reports: ProblemReport[] = [];
  private listeners = new Set<() => void>();
  private readonly auth: MockAuthRepository;

  constructor(auth: MockAuthRepository) {
    this.auth = auth;
  }

  subscribe(onChange: (reports: ProblemReport[]) => void): Unsubscribe {
    const emit = () => onChange(structuredClone(this.reports.slice(0, 100)));
    this.listeners.add(emit);
    emit();
    return () => this.listeners.delete(emit);
  }

  async report(input: { description: string; context: ProblemContext }) {
    const a = this.auth.current();
    if (!a?.role) throw new Error('Only dashboard staff report problems here.');
    const description = input.description.trim();
    if (!description) throw new Error('Describe what went wrong first.');
    this.reports.unshift({
      id: `report_mock_${this.reports.length + 1}`,
      description,
      context: input.context,
      at: new Date().toISOString(),
      reporterUid: a.uid,
      reporterEmail: a.email,
      reporterRole: a.role,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByEmail: null,
    });
    this.listeners.forEach((l) => l());
  }

  async resolve(id: string) {
    const a = this.auth.current();
    if (!can(a?.role, 'problems.manage')) throw new Error('Only admins resolve problem reports.');
    const report = this.reports.find((r) => r.id === id);
    if (!report) throw new Error('That report no longer exists.');
    if (report.resolvedAt) throw new Error('Someone already resolved it.');
    Object.assign(report, {
      resolvedAt: new Date().toISOString(),
      resolvedBy: a!.uid,
      resolvedByEmail: a!.email,
    });
    this.listeners.forEach((l) => l());
  }
}

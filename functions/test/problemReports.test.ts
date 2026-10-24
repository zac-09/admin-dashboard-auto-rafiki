import type { ProblemReport } from '../../src/types/problemReports';
import { reportProblem, resolveProblemReport, type ProblemReportDeps } from '../src/problemReports';
import type { Caller } from '../src/setUserRole';

const SUPPORT: Caller = { uid: 's1', email: 'support@autorafiki.test', role: 'support' };
const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };
const NOW = '2026-10-24T09:00:00.000Z';
const CONTEXT = {
  path: '/jobs/job_1',
  pageTitle: 'Job · AutoRafiki Ops',
  userAgent: 'Mozilla/5.0',
  viewport: '1440×900',
  theme: 'dark',
};

function world() {
  const reports = new Map<string, Omit<ProblemReport, 'id'>>();
  const deps: ProblemReportDeps = {
    async add(report) {
      const id = `r${reports.size + 1}`;
      reports.set(id, report);
      return id;
    },
    async resolve(id, by) {
      const r = reports.get(id);
      if (!r) return 'missing';
      if (r.resolvedAt) return 'already';
      reports.set(id, { ...r, resolvedAt: by.at, resolvedBy: by.uid, resolvedByEmail: by.email });
      return 'ok';
    },
    now: () => new Date(NOW),
  };
  return { deps, reports };
}

describe('problem reports', () => {
  it('any staff role reports one, with who, when and the page it happened on', async () => {
    const { deps, reports } = world();
    await reportProblem(SUPPORT, { description: '  Map is blank  ', context: CONTEXT }, deps);
    expect(reports.get('r1')).toEqual({
      description: 'Map is blank',
      context: CONTEXT,
      at: NOW,
      reporterUid: 's1',
      reporterEmail: 'support@autorafiki.test',
      reporterRole: 'support',
      resolvedAt: null,
      resolvedBy: null,
      resolvedByEmail: null,
    });
  });

  it('keeps only known context fields, trimmed, with a safe path and theme', async () => {
    const { deps, reports } = world();
    await reportProblem(
      SUPPORT,
      {
        description: 'x',
        context: {
          path: 'https://evil.test',
          theme: 'neon',
          extra: 'dropped',
          userAgent: 'u'.repeat(900),
        },
      },
      deps,
    );
    const context = reports.get('r1')!.context;
    expect(context).toEqual({
      path: '/',
      pageTitle: '',
      userAgent: 'u'.repeat(400),
      viewport: '',
      theme: 'light',
    });
  });

  it('refuses app users, signed-out callers, and empty or long reports', async () => {
    const { deps } = world();
    const appUser: Caller = { uid: 'u', email: null, role: null };
    await expect(reportProblem(appUser, { description: 'x' }, deps)).rejects.toThrow(/staff/);
    await expect(reportProblem(null, { description: 'x' }, deps)).rejects.toThrow(/Sign in/);
    await expect(reportProblem(OPS, { description: '  ' }, deps)).rejects.toThrow(/Describe/);
    await expect(reportProblem(OPS, { description: 'x'.repeat(2001) }, deps)).rejects.toThrow(
      /2000/,
    );
  });

  it('only admins resolve, once', async () => {
    const { deps, reports } = world();
    await reportProblem(OPS, { description: 'x', context: CONTEXT }, deps);
    await expect(resolveProblemReport(OPS, { id: 'r1' }, deps)).rejects.toThrow(/admins/);
    await resolveProblemReport(ADMIN, { id: 'r1' }, deps);
    expect(reports.get('r1')).toMatchObject({ resolvedAt: NOW, resolvedBy: 'a1' });
    await expect(resolveProblemReport(ADMIN, { id: 'r1' }, deps)).rejects.toThrow(/already/);
    await expect(resolveProblemReport(ADMIN, { id: 'nope' }, deps)).rejects.toThrow(/no longer/);
    await expect(resolveProblemReport(ADMIN, { id: 'a/b' }, deps)).rejects.toThrow(/Which/);
  });
});

import { useMutation } from '@tanstack/react-query';

import { can } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useSession } from '@/lib/session';
import { useLive } from '@/lib/useLive';
import type { ProblemContext, ProblemReport } from '@/types';

/** Live reports for admins; nothing (and no listener) for other roles. */
export function useProblemReports() {
  const { problems } = useRepositories();
  const allowed = can(useSession()?.role, 'problems.manage');
  return useLive<ProblemReport[]>(allowed ? 'problem-reports' : 'problem-reports:none', (n, f) =>
    allowed ? problems.subscribe(n, f) : () => {},
  );
}

export function useReportProblem() {
  const { problems } = useRepositories();
  return useMutation({
    mutationFn: (input: { description: string; context: ProblemContext }) => problems.report(input),
  });
}

/** What the browser can tell about where and how the problem happened. */
export function currentContext(path: string): ProblemContext {
  return {
    path,
    pageTitle: document.title,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  };
}

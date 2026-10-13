import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, staggerDelay } from '@/components/motion';
import { Notice, SkeletonTable, Tabs } from '@/components/ui';
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABELS,
  auditActors,
  auditTargetPath,
  auditTargetType,
  filterAudit,
} from '@/lib/auditActions';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { AuditAction, AuditEntry } from '@/types';

const WINDOWS = [
  { id: '7' as const, label: 'Last 7 days' },
  { id: '30' as const, label: 'Last 30 days' },
  { id: '90' as const, label: 'Last 90 days' },
  { id: 'all' as const, label: 'All time' },
];
type Window = (typeof WINDOWS)[number]['id'];

const SELECT =
  'min-h-10 rounded-control border border-hairline bg-background px-3 text-sm text-primary';

function useAuditEntries(window: Window) {
  const { audit } = useRepositories();
  return useQuery({
    queryKey: ['audit', 'all', window],
    queryFn: () =>
      audit.listEntries(
        window === 'all' ? null : new Date(Date.now() - Number(window) * 86_400_000).toISOString(),
      ),
  });
}

function Entry({ entry, index, count }: { entry: AuditEntry; index: number; count: number }) {
  const path = auditTargetPath(entry);
  const role = entry.actorRole === 'system' ? 'System' : ROLE_LABELS[entry.actorRole];
  return (
    <Reveal
      as="li"
      delay={staggerDelay(index, count)}
      className="flex gap-3 border-b border-hairline px-4 py-3 text-sm last:border-0"
    >
      <span aria-hidden className="mt-1.5 diamond text-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
          <span className="text-muted">
            {auditTargetType(entry.targetType)}:{' '}
            {path ? (
              <Link to={path} className="text-primary underline">
                {entry.targetLabel || entry.targetId}
              </Link>
            ) : (
              entry.targetLabel || entry.targetId
            )}
          </span>
        </div>
        <span className="text-xs text-muted">
          {formatDateTime(entry.at)} · {entry.actorEmail ?? entry.actorUid} ({role})
        </span>
        {entry.before !== null || entry.after !== null ? (
          <span className="text-xs break-words text-muted">
            {entry.before ?? 'none'} → {entry.after ?? 'none'}
          </span>
        ) : null}
        <span className="break-words">{entry.reason}</span>
      </div>
    </Reveal>
  );
}

/** Every audited decision in one place: who did what, to whom, when and why. */
export function AuditLogPage() {
  useDocumentTitle('Audit log');
  const [params, setParams] = useSearchParams();
  const window = (WINDOWS.find((w) => w.id === params.get('window'))?.id ?? '30') as Window;
  const action = (params.get('action') as AuditAction | null) ?? null;
  const actor = params.get('actor');
  const text = params.get('q') ?? '';
  const entries = useAuditEntries(window);

  function set(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const shown = entries.data ? filterAudit(entries.data, { action, actor, text }) : [];

  return (
    <>
      <PageHeader label="Admin" title="Audit log" />
      <Tabs
        label="Audit window"
        value={window}
        onChange={(id) => set('window', id === '30' ? null : id)}
        items={WINDOWS}
      />
      <div
        className="mb-4 flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter the log"
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          What
          <select
            aria-label="Action"
            value={action ?? ''}
            onChange={(e) => set('action', e.target.value || null)}
            className={SELECT}
          >
            <option value="">Any action</option>
            {AUDIT_ACTION_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.actions.map((a) => (
                  <option key={a} value={a}>
                    {AUDIT_ACTION_LABELS[a]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Who
          <select
            aria-label="Staff member"
            value={actor ?? ''}
            onChange={(e) => set('actor', e.target.value || null)}
            className={SELECT}
          >
            <option value="">Anyone</option>
            {auditActors(entries.data ?? []).map((a) => (
              <option key={a.uid} value={a.uid}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted">
          Search
          <input
            type="search"
            aria-label="Search the log"
            value={text}
            onChange={(e) => set('q', e.target.value || null)}
            placeholder="Mechanic, job id, reason…"
            className={`${SELECT} w-full`}
          />
        </label>
      </div>

      {entries.isPending ? (
        <SkeletonTable rows={6} columns={3} label="Loading audit log" />
      ) : entries.error ? (
        <Notice tone="error">Could not load the audit log: {entries.error.message}</Notice>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted" aria-live="polite">
            {shown.length === entries.data.length
              ? `${shown.length} ${shown.length === 1 ? 'entry' : 'entries'}`
              : `${shown.length} of ${entries.data.length} entries match`}
          </p>
          {shown.length === 0 ? (
            <Reveal className="panel p-6 text-sm text-muted">
              Nothing recorded matches. Try a longer window or clear a filter.
            </Reveal>
          ) : (
            <ol key={`${window}|${action}|${actor}`} className="panel" aria-label="Audit entries">
              {shown.map((e, i) => (
                <Entry key={e.id} entry={e} index={i} count={shown.length} />
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}

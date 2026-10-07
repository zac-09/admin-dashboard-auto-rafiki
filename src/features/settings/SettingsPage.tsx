import type { ReactNode } from 'react';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, staggerDelay } from '@/components/motion';
import { formatDate, formatUgx } from '@/lib/format';
import { SERVICE_LABELS } from '@/lib/labels';
import { APP_CALLOUT_PRICES } from '@/lib/pricing';
import {
  kampalaMidnight,
  OVERDUE_AFTER_DAYS,
  TRACKING_START,
  WEEKLY_FEE,
} from '@/lib/subscriptions';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useThemeMode } from '@/theme/themeMode';
import { BROADCAST, type ServiceType } from '@/types';

function Panel({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  return (
    <Reveal as="section" aria-label={title} delay={staggerDelay(index, 4)} className="panel p-5">
      <h2 className="micro-label mb-3">{title}</h2>
      {children}
    </Reveal>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="text-sm">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex min-h-10 items-center justify-between gap-4 border-b border-hairline last:border-0"
        >
          <dt className="text-muted">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Read-only. Prices, radius and broadcast window are compiled into the app; they become editable
 * here once the app reads a `settings` document (a cross-repo change, see CLAUDE.md).
 */
export function SettingsPage() {
  useDocumentTitle('Settings');
  const { mode, toggle } = useThemeMode();
  return (
    <>
      <PageHeader label="Admin" title="Settings" />
      <p className="mb-4 flex max-w-3xl items-start gap-3 rounded-control border border-hairline px-4 py-3 text-sm">
        <span aria-hidden className="mt-1.5 diamond text-accent" />
        <span>
          <span className="font-semibold">Read-only for now.</span> Prices, broadcast radius and the
          broadcast window are built into the app. They become editable here once the app reads a
          shared settings document, a change scheduled with the app.
        </span>
      </p>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title="Upfront prices (set in the app)" index={0}>
          <Rows
            rows={(Object.keys(APP_CALLOUT_PRICES) as ServiceType[]).map((s) => [
              SERVICE_LABELS[s],
              formatUgx(APP_CALLOUT_PRICES[s]),
            ])}
          />
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Broadcast (set in the app)" index={1}>
            <Rows
              rows={[
                ['First broadcast radius', `${BROADCAST.initialRadiusKm} km`],
                ['Widened once to', `${BROADCAST.expandedRadiusKm} km`],
                ['Each broadcast window', `${BROADCAST.windowMs / 1000} seconds`],
              ]}
            />
          </Panel>
          <Panel title="Subscriptions (dashboard)" index={2}>
            <Rows
              rows={[
                ['Weekly fee', formatUgx(WEEKLY_FEE)],
                ['Week', 'Monday to Sunday, Kampala time'],
                ['Due', 'Monday'],
                ['Overdue', `${OVERDUE_AFTER_DAYS} days later (Thursday)`],
                ['Who pays', 'Every verified mechanic'],
                [
                  'Tracking since',
                  formatDate(new Date(kampalaMidnight(TRACKING_START)).toISOString()),
                ],
              ]}
            />
          </Panel>
          <Panel title="Appearance (this browser)" index={3}>
            <div className="flex min-h-10 items-center justify-between gap-4 text-sm">
              <span className="text-muted">Dark mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={mode === 'dark'}
                aria-label="Dark mode"
                onClick={toggle}
                className={`relative h-6 w-11 rounded-full border border-hairline transition-colors ${
                  mode === 'dark' ? 'bg-primary' : 'bg-surface'
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0.5 size-[1.125rem] rounded-full bg-background shadow transition-transform ${
                    mode === 'dark' ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

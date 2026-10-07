import { useState, type ReactNode } from 'react';

import { PageHeader } from '@/app/pages/PageHeader';
import { Reveal, staggerDelay, SuccessMoment } from '@/components/motion';
import { Button, Notice, SkeletonPanel } from '@/components/ui';
import { SERVICES } from '@/lib/appSettings';
import { formatDate, formatDateTime, formatUgx } from '@/lib/format';
import { SERVICE_LABELS } from '@/lib/labels';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import {
  kampalaMidnight,
  OVERDUE_AFTER_DAYS,
  TRACKING_START,
  WEEKLY_FEE,
} from '@/lib/subscriptions';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useThemeMode } from '@/theme/themeMode';

import { useAppSettings } from './hooks';
import { SettingsEditor } from './SettingsEditor';

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

type Moment = { status: 'pending' | 'success'; subtitle: string } | null;

export function SettingsPage() {
  useDocumentTitle('Settings');
  const session = useSession();
  const { mode, toggle } = useThemeMode();
  const live = useAppSettings();
  const [editing, setEditing] = useState(false);
  const [moment, setMoment] = useState<Moment>(null);
  const canEdit = can(session?.role, 'settings.edit');

  const status =
    live.status === 'ready' && live.effective ? (
      <p className="mb-4 flex max-w-3xl items-start gap-3 rounded-control border border-hairline px-4 py-3 text-sm">
        {live.effective.source === 'remote' ? (
          <>
            <span
              aria-hidden
              className="mt-1 size-2 shrink-0 rounded-full bg-success sonar text-success"
            />
            <span>
              <span className="font-semibold">Live in the app.</span> These are the published
              settings the app uses for new requests
              {live.effective.settings.updatedAt
                ? `, last published ${formatDateTime(live.effective.settings.updatedAt)}`
                : ''}
              .
            </span>
          </>
        ) : (
          <>
            <span aria-hidden className="mt-1.5 diamond text-accent" />
            <span>
              <span className="font-semibold">Not published yet.</span> The app is using its
              built-in values, shown below.{' '}
              {canEdit ? 'Publishing creates the shared settings the app reads.' : ''}
            </span>
          </>
        )}
      </p>
    ) : null;

  return (
    <>
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Publishing…"
          title="Settings published"
          subtitle={moment.subtitle}
          onDone={() => setMoment(null)}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader label="Admin" title="Settings" />
        {canEdit && !editing && live.status === 'ready' ? (
          <Button onClick={() => setEditing(true)}>Edit prices & broadcast</Button>
        ) : null}
      </div>
      {status}

      {live.status === 'loading' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={3} />
        </div>
      ) : live.status === 'error' ? (
        <Notice tone="error">Could not load settings: {live.error.message}</Notice>
      ) : editing && live.effective ? (
        <SettingsEditor
          current={live.effective.settings}
          onCancel={() => setEditing(false)}
          onStart={() => setMoment({ status: 'pending', subtitle: '' })}
          onFailed={() => setMoment(null)}
          onDone={(changes) => {
            setEditing(false);
            setMoment({
              status: 'success',
              subtitle: changes.length
                ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} live for new requests`
                : 'The app now reads the shared settings',
            });
          }}
        />
      ) : live.effective ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel title="Upfront prices" index={0}>
            <Rows
              rows={SERVICES.map((s) => [
                SERVICE_LABELS[s],
                formatUgx(live.effective!.settings.prices[s]),
              ])}
            />
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel title="Broadcast" index={1}>
              <Rows
                rows={[
                  [
                    'First broadcast radius',
                    `${live.effective.settings.broadcast.initialRadiusKm} km`,
                  ],
                  ['Widened once to', `${live.effective.settings.broadcast.expandedRadiusKm} km`],
                  [
                    'Each broadcast window',
                    `${live.effective.settings.broadcast.windowMs / 1000} seconds`,
                  ],
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
      ) : null}
    </>
  );
}

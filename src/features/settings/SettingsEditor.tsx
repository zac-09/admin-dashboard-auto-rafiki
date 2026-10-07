import { useState, type FormEvent } from 'react';

import { Reveal } from '@/components/motion';
import { Button, Notice } from '@/components/ui';
import { checkAppSettings, LIMITS, SERVICES, settingsChanges } from '@/lib/appSettings';
import { SERVICE_LABELS } from '@/lib/labels';
import { MAX_REASON } from '@/lib/vetting';
import type { AppSettings } from '@/types';

import { usePublishSettings } from './hooks';

/** Text inputs (so half-typed numbers don't jump), parsed for checking and publishing. */
type Draft = { prices: Record<string, string>; initial: string; expanded: string; windowS: string };

function toDraft(s: AppSettings): Draft {
  return {
    prices: Object.fromEntries(SERVICES.map((k) => [k, String(s.prices[k])])),
    initial: String(s.broadcast.initialRadiusKm),
    expanded: String(s.broadcast.expandedRadiusKm),
    windowS: String(s.broadcast.windowMs / 1000),
  };
}

function fromDraft(d: Draft): unknown {
  const n = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/[,\s]/g, '')));
  return {
    version: 1,
    prices: Object.fromEntries(SERVICES.map((k) => [k, n(d.prices[k] ?? '')])),
    broadcast: {
      initialRadiusKm: n(d.initial),
      expandedRadiusKm: n(d.expanded),
      windowMs: Math.round(n(d.windowS) * 1000),
    },
  };
}

function Field({
  id,
  label,
  unit,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline py-1.5 last:border-0">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted">{unit}</span>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-10 w-28 rounded-control border bg-background px-3 text-right text-sm font-semibold ${
            error ? 'border-danger' : 'border-hairline'
          }`}
        />
      </span>
      {error ? (
        <span id={`${id}-error`} className="w-full text-right text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function SettingsEditor({
  current,
  onStart,
  onDone,
  onFailed,
  onCancel,
}: {
  current: AppSettings;
  onStart: () => void;
  onDone: (changes: string[]) => void;
  onFailed: () => void;
  onCancel: () => void;
}) {
  const publish = usePublishSettings();
  const [draft, setDraft] = useState(() => toDraft(current));
  const [reason, setReason] = useState('');
  const check = checkAppSettings(fromDraft(draft));
  const errors = check.ok ? {} : check.errors;
  const changes = check.ok ? settingsChanges(current, check.settings, SERVICE_LABELS) : [];
  const firstPublish = !current.updatedAt;
  const missing = !check.ok
    ? 'Fix the highlighted values'
    : changes.length === 0 && !firstPublish
      ? 'Change a value to publish'
      : !reason.trim()
        ? 'Add a reason for the audit log'
        : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!check.ok || missing) return;
    onStart();
    try {
      const result = await publish.mutateAsync({ next: check.settings, reason: reason.trim() });
      onDone(result.changes);
    } catch {
      onFailed();
    }
  }

  const setPrice = (k: string) => (v: string) =>
    setDraft((d) => ({ ...d, prices: { ...d.prices, [k]: v } }));

  return (
    <form onSubmit={onSubmit} aria-label="Edit settings" className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section aria-label="Prices" className="panel p-5">
          <h2 className="micro-label mb-2">Upfront prices</h2>
          {SERVICES.map((k) => (
            <Field
              key={k}
              id={`price-${k}`}
              label={SERVICE_LABELS[k]}
              unit="UGX"
              value={draft.prices[k] ?? ''}
              error={errors[`prices.${k}`]}
              onChange={setPrice(k)}
            />
          ))}
        </section>
        <section aria-label="Broadcast" className="panel p-5">
          <h2 className="micro-label mb-2">Broadcast</h2>
          <Field
            id="initial-radius"
            label="First broadcast radius"
            unit="km"
            value={draft.initial}
            error={errors['broadcast.initialRadiusKm']}
            onChange={(v) => setDraft((d) => ({ ...d, initial: v }))}
          />
          <Field
            id="expanded-radius"
            label="Widened once to"
            unit="km"
            value={draft.expanded}
            error={errors['broadcast.expandedRadiusKm']}
            onChange={(v) => setDraft((d) => ({ ...d, expanded: v }))}
          />
          <Field
            id="window"
            label="Each broadcast window"
            unit="seconds"
            value={draft.windowS}
            error={errors['broadcast.windowMs']}
            onChange={(v) => setDraft((d) => ({ ...d, windowS: v }))}
          />
          <p className="mt-3 text-xs text-muted">
            Limits: prices UGX {LIMITS.price.min.toLocaleString('en-US')}–
            {LIMITS.price.max.toLocaleString('en-US')}, radii {LIMITS.radiusKm.min}–
            {LIMITS.radiusKm.max} km, window 30 s–10 min (the app's own checks).
          </p>
        </section>
      </div>

      <section aria-label="Changes" className="panel flex flex-col gap-3 p-5">
        <h2 className="micro-label">What will change</h2>
        {changes.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {changes.map((c) => (
              <Reveal as="li" key={c} from="fade" className="flex items-center gap-3">
                <span aria-hidden className="diamond text-accent" />
                {c}
              </Reveal>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            {!check.ok
              ? 'Fix the highlighted values to see what will change.'
              : firstPublish
                ? 'Nothing yet. Publishing as-is creates the shared settings with the app’s current values.'
                : 'Nothing yet.'}
          </p>
        )}
        <p className="text-xs text-muted">
          New requests use published values within seconds. Jobs already requested keep their fee.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="micro-label">Reason (kept in the audit log)</span>
          <input
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
          />
        </label>
        {publish.error ? <Notice tone="error">{publish.error.message}</Notice> : null}
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            id="publish-settings"
            type="submit"
            disabled={!!missing || publish.isPending}
            hint={publish.isPending ? null : missing}
          >
            Publish to the app
          </Button>
        </div>
      </section>
    </form>
  );
}

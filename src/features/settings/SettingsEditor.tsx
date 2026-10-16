import { useState, type FormEvent } from 'react';

import { Reveal } from '@/components/motion';
import { Button, Notice } from '@/components/ui';
import {
  CATALOGUE_ID,
  checkAppSettings,
  LIMITS,
  removedCatalogueIds,
  SERVICES,
  settingsChanges,
} from '@/lib/appSettings';
import { PLACEHOLDER_EMERGENCY_PHONE } from '@/lib/catalogue';
import { SERVICE_LABELS } from '@/lib/labels';
import { MAX_REASON } from '@/lib/vetting';
import type { AppSettings, ServiceType } from '@/types';

import { usePublishSettings } from './hooks';

/** Text inputs (so half-typed numbers don't jump), parsed for checking and publishing. */
interface DraftItem {
  id: string;
  label: string;
  service: ServiceType;
  /** In the currently published catalogue: its id is locked (jobs store it). */
  published: boolean;
}
interface DraftPackage {
  id: string;
  label: string;
  price: string;
  description: string;
  /** Published: its id is locked (bookings store it). */
  published: boolean;
}
interface Draft {
  servicing: DraftPackage[];
  prices: Record<string, string>;
  initial: string;
  expanded: string;
  windowS: string;
  emergencyPhone: string;
  email: string;
  catalogue: DraftItem[];
}

function toDraft(s: AppSettings): Draft {
  return {
    prices: Object.fromEntries(SERVICES.map((k) => [k, String(s.prices[k])])),
    initial: String(s.broadcast.initialRadiusKm),
    expanded: String(s.broadcast.expandedRadiusKm),
    windowS: String(s.broadcast.windowMs / 1000),
    emergencyPhone: s.support.emergencyPhone,
    email: s.support.email,
    catalogue: s.catalogue.map((c) => ({ ...c, published: true })),
    servicing: s.servicing.map((p) => ({ ...p, price: String(p.price), published: true })),
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
    support: { emergencyPhone: d.emergencyPhone.replace(/[\s-]/g, ''), email: d.email.trim() },
    catalogue: d.catalogue.map(({ id, label, service }) => ({ id, label, service })),
    servicing: d.servicing.map(({ id, label, price, description }) => ({
      id,
      label,
      price: n(price),
      description,
    })),
  };
}

function Field({
  id,
  label,
  unit,
  value,
  error,
  onChange,
  wide = false,
  inputMode = 'decimal',
}: {
  id: string;
  label: string;
  unit?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  wide?: boolean;
  inputMode?: 'decimal' | 'tel' | 'email' | 'text';
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline py-1.5 last:border-0">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <span className="flex items-center gap-2">
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
        <input
          id={id}
          inputMode={inputMode}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-10 rounded-control border bg-background px-3 text-sm font-semibold ${
            wide ? 'w-64 max-w-full' : 'w-28 text-right'
          } ${error ? 'border-danger' : 'border-hairline'}`}
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

/** Adds a catalogue item: a new slug id, a label, the fault it belongs to. */
function AddItem({ taken, onAdd }: { taken: Set<string>; onAdd: (item: DraftItem) => void }) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [service, setService] = useState<ServiceType>('other');
  const slug = id.trim();
  const problem = !slug
    ? null
    : !CATALOGUE_ID.test(slug)
      ? 'Lowercase letters, digits and dashes, 2–40 characters.'
      : taken.has(slug)
        ? 'That id is already used.'
        : null;
  const ready = !!slug && !problem && label.trim().length > 0 && label.trim().length <= 40;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-control border border-dashed border-hairline p-3">
      <span className="micro-label">Add an item</span>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Id (permanent)
          <input
            aria-label="New item id"
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            placeholder="tyre-rim"
            aria-invalid={!!problem}
            className={`min-h-10 w-40 rounded-control border bg-background px-3 text-sm ${problem ? 'border-danger' : 'border-hairline'}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Label (what customers see)
          <input
            aria-label="New item label"
            value={label}
            maxLength={LIMITS.catalogue.maxLabel}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Rim repair"
            className="min-h-10 w-52 rounded-control border border-hairline bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Fault
          <select
            aria-label="New item fault"
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType)}
            className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
          >
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={!ready}
          onClick={() => {
            onAdd({ id: slug, label: label.trim(), service, published: false });
            setId('');
            setLabel('');
          }}
        >
          Add item
        </Button>
      </div>
      {problem ? <span className="text-xs text-danger">{problem}</span> : null}
    </div>
  );
}

/** Adds a servicing package: a new slug id, a name, a price, one line on what's included. */
function AddPackage({
  taken,
  full,
  onAdd,
}: {
  taken: Set<string>;
  full: boolean;
  onAdd: (pkg: DraftPackage) => void;
}) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const slug = id.trim().toLowerCase();
  const problem = full
    ? `At most ${LIMITS.servicing.maxItems} packages`
    : !CATALOGUE_ID.test(slug)
      ? 'Id: lowercase letters, digits and dashes'
      : taken.has(slug)
        ? `"${slug}" already exists`
        : !label.trim()
          ? 'Give it a name'
          : !price.trim()
            ? 'Give it a price'
            : null;
  const FIELD = 'min-h-10 rounded-control border border-hairline bg-background px-3 text-sm';
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
      <span className="text-xs font-semibold">Add a package</span>
      <div className="flex flex-wrap items-end gap-2">
        <input
          aria-label="New package id"
          placeholder="tyre-rotation"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className={`${FIELD} w-44`}
        />
        <input
          aria-label="New package name"
          placeholder="Tyre rotation"
          value={label}
          maxLength={LIMITS.servicing.maxLabel}
          onChange={(e) => setLabel(e.target.value)}
          className={`${FIELD} w-52`}
        />
        <input
          aria-label="New package price"
          placeholder="40000"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={`${FIELD} w-28`}
        />
      </div>
      <input
        aria-label="New package description"
        placeholder="What's included, in one line"
        value={description}
        maxLength={LIMITS.servicing.maxDescription}
        onChange={(e) => setDescription(e.target.value)}
        className={`${FIELD} w-full`}
      />
      <Button
        variant="secondary"
        disabled={!!problem}
        hint={problem}
        onClick={() => {
          onAdd({
            id: slug,
            label: label.trim(),
            price: price.trim(),
            description: description.trim(),
            published: false,
          });
          setId('');
          setLabel('');
          setPrice('');
          setDescription('');
        }}
      >
        Add package
      </Button>
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
  // Published ids can only be relabelled, never removed (jobs store them); the UI offers no
  // remove control for them, so this only guards against a draft built elsewhere.
  const lost = check.ok ? removedCatalogueIds(current.catalogue, check.settings.catalogue) : [];
  const placeholderPhone =
    draft.emergencyPhone.replace(/[\s-]/g, '') === PLACEHOLDER_EMERGENCY_PHONE;
  const missing = !check.ok
    ? 'Fix the highlighted values'
    : lost.length
      ? `Published items cannot be removed: ${lost.join(', ')}`
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
  const setItem = (i: number, patch: Partial<DraftItem>) =>
    setDraft((d) => ({
      ...d,
      catalogue: d.catalogue.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));
  const takenIds = new Set(draft.catalogue.map((c) => c.id));
  const setPackage = (i: number, patch: Partial<DraftPackage>) =>
    setDraft((d) => ({
      ...d,
      servicing: d.servicing.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));

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
        <div className="flex flex-col gap-4">
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
          <section aria-label="Support contacts" className="panel p-5">
            <h2 className="micro-label mb-2">Support contacts (shown in the app)</h2>
            <Field
              id="emergency-phone"
              label="Emergency line"
              value={draft.emergencyPhone}
              error={errors['support.emergencyPhone']}
              onChange={(v) => setDraft((d) => ({ ...d, emergencyPhone: v }))}
              wide
              inputMode="tel"
            />
            <Field
              id="support-email"
              label="Support email"
              value={draft.email}
              error={errors['support.email']}
              onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
              wide
              inputMode="email"
            />
            {placeholderPhone ? (
              <p className="mt-3 flex items-start gap-2 text-xs">
                <span aria-hidden className="mt-1 diamond sonar text-warning" />
                <span>
                  <span className="font-semibold">This is the app's placeholder number.</span> Every
                  job screen offers to call it. Set the real emergency line before launch.
                </span>
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section aria-label="Catalogue" className="panel p-5">
        <h2 className="micro-label mb-1">Request catalogue (the parts and jobs customers tap)</h2>
        <p className="mb-3 text-xs text-muted">
          Ids are stored on jobs, so a published item can be relabelled or moved to another fault
          but never removed. {draft.catalogue.length} of {LIMITS.catalogue.maxItems} items.
        </p>
        <ul className="flex flex-col" aria-label="Catalogue items">
          {draft.catalogue.map((item, i) => (
            <li
              key={item.id}
              className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-1.5 last:border-0"
            >
              <code
                className="w-44 shrink-0 text-xs text-muted"
                title={item.published ? 'Published: locked' : 'New'}
              >
                {item.id}
                {item.published ? '' : ' · new'}
              </code>
              <input
                aria-label={`Label for ${item.id}`}
                value={item.label}
                maxLength={LIMITS.catalogue.maxLabel}
                aria-invalid={!!errors[`catalogue.${i}.label`]}
                onChange={(e) => setItem(i, { label: e.target.value })}
                className={`min-h-10 w-56 max-w-full rounded-control border bg-background px-3 text-sm ${
                  errors[`catalogue.${i}.label`] ? 'border-danger' : 'border-hairline'
                }`}
              />
              <select
                aria-label={`Fault for ${item.id}`}
                value={item.service}
                onChange={(e) => setItem(i, { service: e.target.value as ServiceType })}
                className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
              >
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_LABELS[s]}
                  </option>
                ))}
              </select>
              {!item.published ? (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, catalogue: d.catalogue.filter((_, j) => j !== i) }))
                  }
                  className="min-h-10 text-xs text-muted underline hover:text-primary"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <AddItem
          taken={takenIds}
          onAdd={(item) => setDraft((d) => ({ ...d, catalogue: [...d.catalogue, item] }))}
        />
      </section>

      <section aria-label="Servicing" className="panel p-5">
        <h2 className="micro-label mb-1">Booked servicing (fixed-price packages)</h2>
        <p className="mb-3 text-xs text-muted">
          What customers can book ahead at a fixed price. Ids are stored on bookings, so a published
          id is locked: change the name, price or description freely, or withdraw a package
          (bookings already made keep their name and price). {draft.servicing.length} of{' '}
          {LIMITS.servicing.maxItems} packages.
        </p>
        {errors['servicing'] ? <Notice tone="error">{errors['servicing']}</Notice> : null}
        <ul className="flex flex-col" aria-label="Servicing packages">
          {draft.servicing.map((pkg, i) => {
            const err = (k: string) => errors[`servicing.${i}.${k}`];
            const cls = (k: string) =>
              `min-h-10 rounded-control border bg-background px-3 text-sm ${err(k) ? 'border-danger' : 'border-hairline'}`;
            return (
              <li
                key={`${pkg.id}:${i}`}
                className="flex flex-col gap-2 border-b border-hairline py-2.5 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <code className="w-44 shrink-0 text-xs text-muted">
                    {pkg.id}
                    {pkg.published ? '' : ' · new'}
                  </code>
                  <input
                    aria-label={`Name for ${pkg.id}`}
                    value={pkg.label}
                    maxLength={LIMITS.servicing.maxLabel}
                    aria-invalid={!!err('label')}
                    onChange={(e) => setPackage(i, { label: e.target.value })}
                    className={`${cls('label')} w-56 max-w-full`}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    UGX
                    <input
                      aria-label={`Price for ${pkg.id}`}
                      inputMode="numeric"
                      value={pkg.price}
                      aria-invalid={!!err('price')}
                      onChange={(e) => setPackage(i, { price: e.target.value })}
                      className={`${cls('price')} w-32`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, servicing: d.servicing.filter((_, j) => j !== i) }))
                    }
                    className="min-h-10 text-xs text-muted underline hover:text-primary"
                  >
                    {pkg.published ? 'Withdraw' : 'Remove'}
                  </button>
                </div>
                <input
                  aria-label={`Description for ${pkg.id}`}
                  value={pkg.description}
                  maxLength={LIMITS.servicing.maxDescription}
                  aria-invalid={!!err('description')}
                  onChange={(e) => setPackage(i, { description: e.target.value })}
                  className={`${cls('description')} w-full`}
                />
                {['id', 'label', 'price', 'description'].map((k) =>
                  err(k) ? (
                    <span key={k} className="text-xs text-danger">
                      {err(k)}
                    </span>
                  ) : null,
                )}
              </li>
            );
          })}
        </ul>
        <AddPackage
          taken={new Set(draft.servicing.map((p) => p.id))}
          full={draft.servicing.length >= LIMITS.servicing.maxItems}
          onAdd={(pkg) => setDraft((d) => ({ ...d, servicing: [...d.servicing, pkg] }))}
        />
      </section>

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

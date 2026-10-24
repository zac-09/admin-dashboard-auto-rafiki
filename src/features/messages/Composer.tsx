import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button, Notice } from '@/components/ui';
import { coverage } from '@/features/insights/coverage';
import { useInsightsInputs } from '@/features/insights/hooks';
import { MESSAGE_LIMITS, NEAR_RADII_KM, recipients, type Audience } from '@/lib/mechanicMessages';
import { useRepositories } from '@/lib/repositories';
import type { MechanicDoc } from '@/types';
import { useUnsaved } from '@/components/unsaved/unsavedStore';

import { useSendMessage } from './hooks';

type Kind = Audience['kind'];
const FIELD =
  'w-full rounded-control border border-hairline bg-background px-3 py-2 text-sm text-primary';
const CHOICE =
  'flex min-h-10 cursor-pointer items-start gap-3 rounded-control border border-hairline px-3 py-2 text-sm has-[:checked]:border-primary';

const DAY_MS = 86_400_000;

/** "Kira (4 unanswered, nearest mechanic 8 km)"; a request's place carries no figures. */
function placeOptionLabel(p: { label: string; unserved: number | null; nearestKm: number | null }) {
  if (p.unserved === null) return p.label;
  const nearest = p.nearestKm === null ? '' : `, nearest mechanic ${Math.round(p.nearestKm)} km`;
  return `${p.label} (${p.unserved} unanswered${nearest})`;
}

/** Places worth messaging about: the worst coverage gaps of the last four weeks. */
function useGapPlaces() {
  const inputs = useInsightsInputs();
  if (!inputs.data) return { places: [], loading: inputs.isPending };
  const since = inputs.data.now.getTime() - 28 * DAY_MS;
  const recent = inputs.data.jobs.filter((j) => Date.parse(j.request.createdAt) >= since);
  return {
    loading: false,
    places: coverage(recent, inputs.data.mechanics)
      .areas.filter((a) => a.unserved > 0)
      .slice(0, 6)
      .map((a) => ({
        key: a.key,
        label: a.label,
        ...a.center,
        unserved: a.unserved,
        nearestKm: a.nearestMechanicKm,
      })),
  };
}

export function Composer({
  initialTo,
  initialPlace,
  onSent,
}: {
  initialTo: string | null;
  /** From an alert: "message mechanics near this request". Offered first and preselected. */
  initialPlace: { latitude: number; longitude: number; label: string } | null;
  onSent: (summary: { title: string; subtitle: string }) => void;
}) {
  const { support } = useRepositories();
  const mechanics = useQuery({
    queryKey: ['support', 'mechanics'],
    queryFn: () => support.listMechanics(),
  });
  const gaps = useGapPlaces();
  const send = useSendMessage();
  const [kind, setKind] = useState<Kind>(initialTo && !initialPlace ? 'mechanics' : 'near');
  const [chosen, setChosen] = useState<Set<string>>(new Set(initialTo ? [initialTo] : []));
  const [filter, setFilter] = useState('');
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  useUnsaved(title.trim() !== '' || body.trim() !== '');

  const places = initialPlace
    ? [
        {
          key: 'request',
          label: `Near this request: ${initialPlace.label}`,
          latitude: initialPlace.latitude,
          longitude: initialPlace.longitude,
          unserved: null as number | null,
          nearestKm: null as number | null,
        },
        ...gaps.places,
      ]
    : gaps.places;
  const place = places.find((p) => p.key === (placeKey ?? places[0]?.key));
  const audience: Audience | null =
    kind === 'verified'
      ? { kind: 'verified' }
      : kind === 'mechanics'
        ? chosen.size
          ? { kind: 'mechanics', mechanicIds: [...chosen] }
          : null
        : place
          ? {
              kind: 'near',
              latitude: place.latitude,
              longitude: place.longitude,
              radiusKm,
              label: place.key === 'request' && initialPlace ? initialPlace.label : place.label,
            }
          : null;
  const all: MechanicDoc[] = mechanics.data ?? [];
  const reached = audience ? recipients(all, audience) : [];
  const withPush = reached.filter((m) => m.fcmToken).length;

  const missing = !audience
    ? kind === 'mechanics'
      ? 'Choose at least one mechanic'
      : 'Choose a place'
    : reached.length === 0
      ? 'Nobody matches yet: widen the radius or pick another audience'
      : !title.trim()
        ? 'Write a title'
        : !body.trim()
          ? 'Write the message'
          : null;

  const shown = all
    .filter((m) => m.businessName.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => a.businessName.localeCompare(b.businessName));

  return (
    <form
      aria-label="New message to mechanics"
      className="panel flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!audience || missing) return;
        send.mutate(
          { title: title.trim(), body: body.trim(), audience },
          {
            onSuccess: (r) => {
              onSent({
                title: 'Message sent',
                subtitle: `${r.recipients} ${r.recipients === 1 ? 'mechanic' : 'mechanics'} · ${r.pushed} by push`,
              });
              setTitle('');
              setBody('');
            },
          },
        );
      }}
    >
      <h2 className="micro-label">New message</h2>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Who gets it</legend>
        <label className={CHOICE}>
          <input
            type="radio"
            name="audience"
            className="mt-1"
            checked={kind === 'near'}
            onChange={() => setKind('near')}
          />
          <span>
            Verified mechanics near a coverage gap
            <span className="block text-xs text-muted">
              For "come online tonight" asks where customers go unanswered.
            </span>
          </span>
        </label>
        <label className={CHOICE}>
          <input
            type="radio"
            name="audience"
            className="mt-1"
            checked={kind === 'verified'}
            onChange={() => setKind('verified')}
          />
          <span>All verified mechanics</span>
        </label>
        <label className={CHOICE}>
          <input
            type="radio"
            name="audience"
            className="mt-1"
            checked={kind === 'mechanics'}
            onChange={() => setKind('mechanics')}
          />
          <span>
            Chosen mechanics
            <span className="block text-xs text-muted">Any status, applicants included.</span>
          </span>
        </label>
      </fieldset>

      {kind === 'near' ? (
        gaps.loading && !initialPlace ? (
          <p className="text-sm text-muted">Finding coverage gaps…</p>
        ) : places.length === 0 ? (
          <p className="text-sm text-muted">
            No unanswered areas in the last four weeks. Choose mechanics instead.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Area (worst coverage gaps, last 4 weeks)
              <select
                aria-label="Area"
                value={place?.key ?? ''}
                onChange={(e) => setPlaceKey(e.target.value)}
                className={`${FIELD} min-h-10`}
              >
                {places.map((p) => (
                  <option key={p.key} value={p.key}>
                    {placeOptionLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Radius">
              <span className="text-xs text-muted">Within</span>
              {NEAR_RADII_KM.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={radiusKm === r}
                  onClick={() => setRadiusKm(r)}
                  className="min-h-10 rounded-control border border-hairline px-3 text-sm aria-pressed:border-primary aria-pressed:font-semibold"
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        )
      ) : null}

      {kind === 'mechanics' ? (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            aria-label="Find a mechanic"
            placeholder="Find a mechanic…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`${FIELD} min-h-10`}
          />
          <ul aria-label="Mechanics" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {shown.map((m) => (
              <li key={m.userId}>
                <label className={CHOICE}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={chosen.has(m.userId)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(m.userId);
                      else next.delete(m.userId);
                      setChosen(next);
                    }}
                  />
                  <span>
                    {m.businessName}
                    <span className="block text-xs text-muted">
                      {m.vetting === 'verified'
                        ? 'Verified'
                        : m.vetting === 'pending'
                          ? 'Applicant'
                          : 'Suspended'}
                      {m.fcmToken ? '' : ' · no push (sees it in the app)'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-muted">
        <span className="flex justify-between">
          <span>Title</span>
          <span>
            {title.length}/{MESSAGE_LIMITS.title}
          </span>
        </span>
        <input
          value={title}
          maxLength={MESSAGE_LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Kira needs cover tonight"
          className={`${FIELD} min-h-10`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        <span className="flex justify-between">
          <span>Message</span>
          <span>
            {body.length}/{MESSAGE_LIMITS.body}
          </span>
        </span>
        <textarea
          value={body}
          maxLength={MESSAGE_LIMITS.body}
          rows={4}
          onChange={(e) => setBody(e.target.value)}
          className={FIELD}
        />
      </label>

      <p className="text-sm" aria-live="polite">
        {mechanics.isPending
          ? 'Counting recipients…'
          : `Reaches ${reached.length} ${reached.length === 1 ? 'mechanic' : 'mechanics'}: ${withPush} by push now, the rest when they next open the app.`}
      </p>
      {send.error ? <Notice tone="error">{send.error.message}</Notice> : null}
      <Button
        type="submit"
        disabled={!!missing || send.isPending}
        loading={send.isPending}
        hint={missing}
      >
        {send.isPending
          ? 'Sending…'
          : `Send to ${reached.length} ${reached.length === 1 ? 'mechanic' : 'mechanics'}`}
      </Button>
    </form>
  );
}

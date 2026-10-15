import { useState } from 'react';
import { Link } from 'react-router';

import { Tabs } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

import { DAYS, demand, slotLabel } from './demand';
import type { InsightsData } from './InsightsPage';
import { supply } from './supply';

type Mode = 'requests' | 'unserved' | 'online';

const MODES = [
  { id: 'requests' as const, label: 'All requests' },
  { id: 'unserved' as const, label: 'Unanswered' },
  { id: 'online' as const, label: 'Mechanics online' },
];

const CAPTIONS: Record<Mode, string> = {
  requests: 'Requests',
  unserved: 'Unanswered requests',
  online: 'Average mechanics online',
};

const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export function DemandTab({ data }: { data: InsightsData }) {
  const session = useSession();
  const [mode, setMode] = useState<Mode>('requests');
  const d = demand(data.jobs);
  const s = supply(data.presence.availability, data.mechanics, data.jobs, data.now);
  const value = (day: number, hour: number): number =>
    mode === 'online'
      ? (s.grid?.[day]?.[hour]?.online ?? 0)
      : mode === 'requests'
        ? d.grid[day]![hour]!.requests
        : d.grid[day]![hour]!.unserved;
  const max =
    mode === 'online'
      ? Math.max(0, ...(s.grid ?? []).flat().map((c) => c.online))
      : mode === 'requests'
        ? d.maxRequests
        : d.maxUnserved;
  const show = (v: number) => (mode === 'online' ? (v >= 0.05 ? oneDp(v) : '') : v || '');
  const weeks = Math.round((data.now.getTime() - Date.parse(data.since)) / 86_400_000 / 7);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        When customers need mechanics and when mechanics are there, by weekday and hour (Kampala
        time). Requests cover the last {weeks} weeks;{' '}
        {s.from === null
          ? 'mechanics online appear once the app has logged availability (it began on 14 Oct 2026).'
          : `mechanics online and the comparison below cover the availability log since ${formatDate(new Date(s.from).toISOString())}.`}
      </p>

      {s.grid ? (
        <section aria-label="Hours with demand but nobody online" className="panel p-4">
          <h3 className="micro-label mb-2">Customers ask, nobody is online</h3>
          {s.uncovered.length === 0 ? (
            <p className="flex items-center gap-3 text-sm text-muted">
              <span aria-hidden className="diamond text-success" />
              Every hour with requests had a mechanic online on average.
            </p>
          ) : (
            <>
              <ol className="flex flex-col gap-1 text-sm">
                {s.uncovered.map((c) => (
                  <li key={`${c.day}:${c.hour}`} className="flex flex-wrap items-center gap-x-3">
                    <span aria-hidden className="diamond text-warning" />
                    <span className="font-semibold">{slotLabel(c.day, c.hour)}</span>
                    <span className="text-muted">
                      {oneDp(c.requestsPerWeek)} requests a week, {oneDp(c.online)} mechanics online
                      on average
                    </span>
                  </li>
                ))}
              </ol>
              {can(session?.role, 'mechanics.message') ? (
                <Link to="/messages" className="mt-3 inline-block text-sm underline">
                  Ask mechanics to come online at these times
                </Link>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {d.worst.length > 0 ? (
        <section aria-label="Hardest hours" className="panel p-4">
          <h3 className="micro-label mb-2">Hours with the most unanswered requests</h3>
          <ol className="flex flex-col gap-1 text-sm">
            {d.worst.map((w) => (
              <li key={`${w.day}:${w.hour}`} className="flex items-center gap-3">
                <span aria-hidden className="diamond text-warning" />
                <span className="font-semibold">{slotLabel(w.day, w.hour)}</span>
                <span className="text-muted">
                  {w.unserved} of {w.requests} requests unanswered
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Tabs label="Demand view" value={mode} onChange={setMode} items={MODES} />
      {mode === 'online' && !s.grid ? (
        <p className="panel p-6 text-sm text-muted">
          No availability log yet. The app writes it when mechanics go online and offline.
        </p>
      ) : (
        <div className="panel overflow-x-auto p-3">
          <table className="w-full min-w-[46rem] border-separate border-spacing-0.5 text-center text-xs">
            <caption className="sr-only">{CAPTIONS[mode]} by weekday and hour</caption>
            <thead>
              <tr>
                <th scope="col" className="w-10 font-normal text-muted">
                  <span className="sr-only">Day</span>
                </th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} scope="col" className="font-normal text-muted">
                    {String(h).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((name, day) => (
                <tr key={name}>
                  <th scope="row" className="pr-1 text-left font-normal text-muted">
                    {name}
                  </th>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const v = value(day, hour);
                    const strength = max ? v / max : 0;
                    const supplyCell = s.grid?.[day]?.[hour];
                    return (
                      <td
                        key={hour}
                        title={`${slotLabel(day, hour)}: ${d.grid[day]![hour]!.requests} requests, ${d.grid[day]![hour]!.unserved} unanswered${supplyCell ? `, ${oneDp(supplyCell.online)} mechanics online on average` : ''}`}
                        className="h-10 rounded-control"
                        style={{
                          // The number is always written; the tint only helps scanning.
                          backgroundColor: v
                            ? `color-mix(in srgb, var(--ar-${mode === 'unserved' ? 'warning' : mode === 'online' ? 'success' : 'accent'}) ${Math.round(12 + strength * 38)}%, transparent)`
                            : undefined,
                        }}
                      >
                        {show(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';

import { Tabs } from '@/components/ui';

import { DAYS, demand, slotLabel } from './demand';
import type { InsightsData } from './InsightsPage';

const MODES = [
  { id: 'requests' as const, label: 'All requests' },
  { id: 'unserved' as const, label: 'Unanswered' },
];

export function DemandTab({ data }: { data: InsightsData }) {
  const [mode, setMode] = useState<'requests' | 'unserved'>('requests');
  const d = demand(data.jobs);
  const max = mode === 'requests' ? d.maxRequests : d.maxUnserved;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        When requests come in, by weekday and hour (Kampala time), over the last{' '}
        {Math.round((data.now.getTime() - Date.parse(data.since)) / 86_400_000 / 7)} weeks. Use it
        to ask mechanics to be online when customers need them.
      </p>
      {d.worst.length > 0 ? (
        <section aria-label="Hardest hours" className="panel p-4">
          <h3 className="micro-label mb-2">Hours that most need more mechanics online</h3>
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
      <div className="panel overflow-x-auto p-3">
        <table className="w-full min-w-[46rem] border-separate border-spacing-0.5 text-center text-xs">
          <caption className="sr-only">
            {mode === 'requests' ? 'Requests' : 'Unanswered requests'} by weekday and hour
          </caption>
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
            {d.grid.map((row, day) => (
              <tr key={day}>
                <th scope="row" className="pr-1 text-left font-normal text-muted">
                  {DAYS[day]}
                </th>
                {row.map((cell, hour) => {
                  const v = mode === 'requests' ? cell.requests : cell.unserved;
                  const strength = max ? v / max : 0;
                  return (
                    <td
                      key={hour}
                      title={`${slotLabel(day, hour)}: ${cell.requests} requests, ${cell.unserved} unanswered`}
                      className="h-10 rounded-control"
                      style={{
                        // The number is always written; the tint only helps scanning.
                        backgroundColor: v
                          ? `color-mix(in srgb, var(--ar-${mode === 'requests' ? 'accent' : 'warning'}) ${Math.round(12 + strength * 38)}%, transparent)`
                          : undefined,
                      }}
                    >
                      {v || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

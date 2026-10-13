import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { springs } from '@/components/motion';

import { niceCeil } from './chartScale';

export interface ChartPoint {
  label: string;
  value: number | null;
  /** Still in progress (this week): drawn hollow and named so in the table. */
  partial?: boolean;
}

const H = 180;

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * A week-by-week line in plain SVG: values as text on the axis and in a table below, so
 * nothing is read from position or colour alone. Gaps (null) break the line.
 */
export function LineChart({
  title,
  points,
  format,
  target,
  max,
}: {
  title: string;
  points: readonly ChartPoint[];
  format: (v: number) => string;
  /** A reference line (e.g. the 30-minute target), labelled on the chart. */
  target?: { value: number; label: string };
  /** A hard ceiling for the axis (1 for shares: never above 100%). */
  max?: number;
}) {
  const tableId = useId();
  // Drawn at the container's real width so axis text stays at 12px on any screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const raw = niceCeil(Math.max(...values, target?.value ?? 0, 0) * 1.05);
  const top = max === undefined ? raw : Math.min(raw, max);
  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);

  // Separate runs so a week without data shows as a gap, not a fake slope.
  const runs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) runs.push([]);
    else {
      if (runs.length === 0) runs.push([]);
      runs[runs.length - 1]!.push({ i, v: p.value });
    }
  });
  // Week labels need about 56px each; thin them out (always keeping the latest) when narrow.
  const labelEvery = Math.max(1, Math.ceil((points.length * 56) / (W - PAD.left - PAD.right)));
  const latest = [...points].reverse().find((p) => p.value !== null);
  const summary = latest
    ? `${title}: ${format(latest.value!)} in the week of ${latest.label}${latest.partial ? ' (so far)' : ''}`
    : `${title}: no data yet`;

  return (
    <figure className="flex flex-col gap-2">
      <div ref={box} className="w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          aria-describedby={tableId}
          className="block max-w-full"
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(top * f)}
                y2={y(top * f)}
                className="stroke-hairline"
              />
              <text
                x={PAD.left - 6}
                y={y(top * f) + 4}
                textAnchor="end"
                className="fill-muted text-xs"
              >
                {format(top * f)}
              </text>
            </g>
          ))}
          {target ? (
            <g>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(target.value)}
                y2={y(target.value)}
                strokeDasharray="4 4"
                className="stroke-warning"
              />
              <text
                x={W - PAD.right}
                y={y(target.value) - 4}
                textAnchor="end"
                className="fill-muted text-xs"
              >
                {target.label}
              </text>
            </g>
          ) : null}
          {runs
            .filter((r) => r.length > 1)
            .map((run, k) => (
              <motion.polyline
                key={k}
                points={run.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                fill="none"
                strokeWidth={2}
                className="stroke-accent"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={springs.settle}
              />
            ))}
          {points.map((p, i) =>
            p.value === null ? null : (
              <rect
                key={i}
                x={x(i) - 4}
                y={y(p.value) - 4}
                width={8}
                height={8}
                transform={`rotate(45 ${x(i)} ${y(p.value)})`}
                className={p.partial ? 'fill-background stroke-accent' : 'fill-accent'}
                strokeWidth={p.partial ? 2 : 0}
              />
            ),
          )}
          {points.map((p, i) =>
            (points.length - 1 - i) % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-xs">
                {p.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted">Show the numbers</summary>
        <table id={tableId} className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-normal">Week of</th>
              <th className="py-1 font-normal">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label} className="border-t border-hairline">
                <td className="py-1">
                  {p.label}
                  {p.partial ? ' (so far)' : ''}
                </td>
                <td className="py-1">{p.value === null ? '–' : format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

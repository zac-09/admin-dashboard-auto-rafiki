import { shortWeek } from './weekLabels';

/** Completed jobs per week as small bars, each with its number written above. */
export function WeeklyBars({
  weekly,
}: {
  weekly: readonly { weekStart: string; completed: number }[];
}) {
  const max = Math.max(1, ...weekly.map((w) => w.completed));
  return (
    <ol aria-label="Completed jobs per week" className="flex h-28 items-end gap-1.5 text-xs">
      {weekly.map((w) => (
        <li
          key={w.weekStart}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          aria-label={`Week of ${shortWeek(w.weekStart)}: ${w.completed} completed`}
        >
          <span aria-hidden>{w.completed}</span>
          <span
            aria-hidden
            className="w-full rounded-t-[2px] bg-accent"
            style={{ height: `${(w.completed / max) * 60}%`, minHeight: w.completed ? 2 : 0 }}
          />
          <span aria-hidden className="truncate text-muted">
            {shortWeek(w.weekStart)}
          </span>
        </li>
      ))}
    </ol>
  );
}

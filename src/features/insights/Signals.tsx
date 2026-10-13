import { CONCERNS, SIGNAL_LABELS, type Signal } from './scorecard';

/** Signals as words with a shape: concerns get the warning diamond, praise the success one. */
export function Signals({ signals }: { signals: readonly Signal[] }) {
  if (signals.length === 0) return <span className="text-muted">–</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {signals.map((s) => {
        const concern = CONCERNS.includes(s);
        return (
          <li
            key={s}
            className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
          >
            <span aria-hidden className={`diamond ${concern ? 'text-warning' : 'text-success'}`} />
            {SIGNAL_LABELS[s]}
          </li>
        );
      })}
    </ul>
  );
}

export interface WheelMarkProps {
  /** Outer diameter in px (the accent ring). Design: 44. */
  size?: number;
  /** Hide the thin accent ring. */
  ring?: boolean;
  /** Accessible name; `null` hides the mark from assistive tech (decorative use). */
  label?: string | null;
}

/**
 * The AutoRafiki mark: a smiling steering wheel (rim, three spokes, hub, accent smile)
 * inside a thin accent ring. Geometry ported from the app's WheelMark.
 */
export function WheelMark({ size = 44, ring = true, label = 'AutoRafiki' }: WheelMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      {...(label === null ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {ring ? (
        <circle cx={22} cy={22} r={20} fill="none" className="stroke-accent" strokeWidth={1.1} />
      ) : null}
      <g className="stroke-primary" strokeWidth={1.6} fill="none">
        <circle cx={22} cy={22} r={9} />
        <line x1={13} y1={22} x2={19.84} y2={22} />
        <line x1={24.16} y1={22} x2={31} y2={22} />
        <line x1={22} y1={13} x2={22} y2={19.84} />
      </g>
      <circle cx={22} cy={22} r={2} className="fill-primary" />
      <path
        d="M18.04,25.6 Q22,28.84 25.96,25.6"
        fill="none"
        className="stroke-accent"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

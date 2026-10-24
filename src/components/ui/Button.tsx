import type { ButtonHTMLAttributes } from 'react';

import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  // Ink fill, not accent: white on the light accent is below 4.5:1 (see tokens.test.ts).
  primary:
    'border border-primary bg-primary text-background hover:opacity-90 active:scale-[0.98] ' +
    // Disabled reads as "not yet", not broken: an outline at full contrast, never a grey slab.
    'disabled:border-hairline disabled:bg-transparent disabled:text-muted disabled:hover:opacity-100 ' +
    // Busy is not "not yet": it keeps its fill while the action runs.
    'aria-busy:border-primary! aria-busy:bg-primary! aria-busy:text-background!',
  secondary:
    'border border-hairline text-primary hover:bg-surface active:scale-[0.98] disabled:text-muted disabled:hover:bg-transparent aria-busy:text-primary!',
  ghost: 'text-primary hover:bg-surface disabled:text-muted aria-busy:text-primary!',
  // Destructive and irreversible: outlined in danger, the label says exactly what happens.
  danger:
    'border border-danger text-danger hover:bg-surface active:scale-[0.98] disabled:border-hairline disabled:text-muted aria-busy:border-danger! aria-busy:text-danger!',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /**
   * Why the button is disabled ("Tick 2 more checks"). Shown under it and linked with
   * aria-describedby, so a disabled button always says what it is waiting for. Pass `null`
   * (not undefined) when there is nothing to say: the wrapper stays mounted, so the button
   * keeps its identity and focus as the hint comes and goes.
   */
  hint?: string | null;
  /**
   * The action is running: a spinner before the label, disabled so it cannot run twice, and
   * aria-busy for screen readers. Keep the label saying what is happening ("Saving…").
   */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  hint,
  id,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const hintId = hint !== undefined && id ? `${id}-hint` : undefined;
  const button = (
    <button
      id={id}
      type={type}
      aria-describedby={hintId}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition disabled:cursor-not-allowed aria-busy:cursor-progress ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
  if (hint === undefined) return button;
  return (
    <div className="flex flex-col gap-1.5">
      {button}
      <p
        id={hintId}
        className="flex min-h-4 items-center gap-2 text-xs text-muted"
        aria-live="polite"
      >
        {hint ? (
          <>
            <span aria-hidden className="diamond scale-75" />
            {hint}
          </>
        ) : null}
      </p>
    </div>
  );
}

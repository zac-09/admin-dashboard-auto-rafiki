import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  // Ink fill, not accent: white on the light accent is below 4.5:1 (see tokens.test.ts).
  primary:
    'border border-primary bg-primary text-background hover:opacity-90 active:scale-[0.98] ' +
    // Disabled reads as "not yet", not broken: an outline at full contrast, never a grey slab.
    'disabled:border-hairline disabled:bg-transparent disabled:text-muted disabled:hover:opacity-100',
  secondary:
    'border border-hairline text-primary hover:bg-surface active:scale-[0.98] disabled:text-muted disabled:hover:bg-transparent',
  ghost: 'text-primary hover:bg-surface disabled:text-muted',
  // Destructive and irreversible: outlined in danger, the label says exactly what happens.
  danger:
    'border border-danger text-danger hover:bg-surface active:scale-[0.98] disabled:border-hairline disabled:text-muted',
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
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  hint,
  id,
  ...props
}: ButtonProps) {
  const hintId = hint !== undefined && id ? `${id}-hint` : undefined;
  const button = (
    <button
      id={id}
      type={type}
      aria-describedby={hintId}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
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

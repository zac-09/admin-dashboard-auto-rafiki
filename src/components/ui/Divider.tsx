/** Hairline rule with the brand diamond at its centre (the app's `Divider diamond`). */
export function DiamondDivider({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-3 text-hairline ${className}`}>
      <span className="h-px flex-1 bg-hairline" />
      <span className="diamond text-accent" />
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

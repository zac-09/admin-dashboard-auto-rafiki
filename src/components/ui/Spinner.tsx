/**
 * A small ring with one arc travelling round it, in the current text colour, so it suits any
 * button variant. Decorative: whoever shows it also says what is happening in words (the
 * button's label, or a status region).
 */
export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <span aria-hidden className={`spinner inline-block shrink-0 rounded-full ${className}`} />;
}

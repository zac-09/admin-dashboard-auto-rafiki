import { useId } from 'react';

/** A search box over a list, saying how much of it is showing. */
export function FilterBox({
  value,
  onChange,
  label,
  placeholder,
  shown,
  total,
}: {
  value: string;
  onChange: (value: string) => void;
  /** What is being filtered, for the label: "Filter mechanics". */
  label: string;
  placeholder?: string;
  shown: number;
  total: number;
}) {
  const id = useId();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="min-h-10 w-full max-w-xs rounded-control border border-hairline bg-background px-3 text-sm focus:border-primary focus:outline-none"
      />
      <span className="text-xs text-muted" aria-live="polite">
        {value.trim() ? `${shown} of ${total} shown` : `${total} in total`}
      </span>
    </div>
  );
}

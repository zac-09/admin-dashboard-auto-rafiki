import { useId, useState, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Labelled input. Password fields get a show/hide toggle. */
export function TextField({ label, className = '', type, ...props }: TextFieldProps) {
  const id = useId();
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="micro-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          className={`min-h-10 w-full rounded-control border border-hairline bg-background px-3 text-sm text-primary transition-colors placeholder:text-muted focus:border-primary ${
            isPassword ? 'pr-16' : ''
          } ${className}`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 min-w-14 rounded-r-control px-3 text-xs font-semibold text-muted hover:text-primary"
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { useId, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, className = '', ...props }: TextFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="micro-label">
        {label}
      </label>
      <input
        id={id}
        className={`min-h-10 rounded-control border border-hairline bg-background px-3 text-sm text-primary placeholder:text-muted ${className}`}
        {...props}
      />
    </div>
  );
}

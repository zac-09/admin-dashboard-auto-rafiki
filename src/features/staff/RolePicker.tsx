import { ROLE_LABELS, ROLE_SUMMARIES } from '@/lib/permissions';
import { ADMIN_ROLES, type AdminRole } from '@/types';

/** Role radios with what each role can do; optionally "Remove access". */
export function RolePicker({
  name,
  value,
  onChange,
  allowNone = false,
  current,
}: {
  name: string;
  value: AdminRole | null | undefined;
  onChange: (role: AdminRole | null) => void;
  allowNone?: boolean;
  /** The member's current role, marked so the change is obvious. */
  current?: AdminRole | null;
}) {
  const options: (AdminRole | null)[] = allowNone ? [...ADMIN_ROLES, null] : [...ADMIN_ROLES];
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="micro-label mb-1.5">Role</legend>
      {options.map((role) => (
        <label
          key={role ?? 'none'}
          className="flex min-h-10 cursor-pointer items-start gap-3 rounded-control border border-hairline px-3 py-2 text-sm has-[:checked]:border-primary"
        >
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span className="flex flex-col">
            <span className="font-semibold">
              {role ? ROLE_LABELS[role] : 'Remove dashboard access'}
              {current !== undefined && current === role ? (
                <span className="font-normal text-muted"> · current</span>
              ) : null}
            </span>
            <span className="text-xs text-muted">
              {role ? ROLE_SUMMARIES[role] : 'They can no longer sign in to the dashboard.'}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

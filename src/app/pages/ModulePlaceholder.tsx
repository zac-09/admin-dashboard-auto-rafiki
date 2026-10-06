import type { NavItem } from '../navigation';

import { PageHeader } from './PageHeader';

/** Stand-in until the module is built (see CLAUDE.md, "Modules, in build order"). */
export function ModulePlaceholder({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader label={`Module ${item.module}`} title={item.label} />
      <section className="panel max-w-2xl p-6">
        <p className="flex items-start gap-3 text-sm">
          <span aria-hidden className="mt-1.5 diamond text-muted" />
          <span>
            <span className="font-semibold">Not built yet. </span>
            <span className="text-muted">{item.summary}</span>
          </span>
        </p>
      </section>
    </>
  );
}

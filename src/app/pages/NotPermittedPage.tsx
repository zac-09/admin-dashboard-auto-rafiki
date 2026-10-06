import { ROLE_LABELS } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

import { PageHeader } from './PageHeader';

export function NotPermittedPage() {
  const session = useSession();
  useDocumentTitle('Restricted');
  return (
    <>
      <PageHeader label="Restricted" title="Not available for your role" />
      <section className="panel max-w-2xl p-6 text-sm">
        <p>
          This page needs a different role than{' '}
          <span className="font-semibold">
            {session?.role ? ROLE_LABELS[session.role] : 'none'}
          </span>
          . Ask an admin if you need access.
        </p>
      </section>
    </>
  );
}

import { Button, WheelMark } from '@/components/ui';
import { getRepositories } from '@/lib/repositories';
import type { AdminSession } from '@/types';

/** Signed in, but the account has no dashboard role (an app user or an unassigned account). */
export function NoAccessPage({ session }: { session: AdminSession }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <section className="panel flex w-full max-w-sm flex-col gap-4 p-6">
        <WheelMark size={44} />
        <h1 className="text-lg font-semibold">No dashboard access</h1>
        <p className="text-sm text-muted">
          {session.email} is signed in but has no dashboard role. An admin can grant one. App
          accounts (phone sign-in) never get dashboard access.
        </p>
        <Button variant="secondary" onClick={() => getRepositories().auth.signOut()}>
          Sign out
        </Button>
      </section>
    </main>
  );
}

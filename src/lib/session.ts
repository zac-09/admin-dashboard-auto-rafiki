import { useEffect } from 'react';
import { create } from 'zustand';

import { getRepositories } from '@/lib/repositories';
import type { AdminSession } from '@/types';

type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: AdminSession };

export const useSessionStore = create<SessionState>(() => ({ status: 'loading', session: null }));

export function setSession(session: AdminSession | null): void {
  useSessionStore.setState(
    session ? { status: 'signedIn', session } : { status: 'signedOut', session: null },
  );
}

/** Mount once at the root: mirrors the auth repository into the session store. */
export function useSessionSync(): void {
  useEffect(() => getRepositories().auth.subscribe(setSession), []);
}

export function useSession(): AdminSession | null {
  return useSessionStore((s) => s.session);
}

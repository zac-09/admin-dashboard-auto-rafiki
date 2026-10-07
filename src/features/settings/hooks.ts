import { useMutation } from '@tanstack/react-query';

import { effectiveSettings } from '@/lib/appSettings';
import { useRepositories } from '@/lib/repositories';
import { useLive } from '@/lib/useLive';
import type { AppSettings } from '@/types';

/** What the app is using right now: the published document, or its built-in defaults. */
export function useAppSettings() {
  const { settings } = useRepositories();
  const live = useLive<unknown | null>('settings-app', (n, f) => settings.subscribe(n, f));
  return {
    ...live,
    effective: live.status === 'ready' ? effectiveSettings(live.data) : null,
  };
}

/** The listener picks up the published document, so there is no cache to invalidate. */
export function usePublishSettings() {
  const { settings } = useRepositories();
  return useMutation({
    mutationFn: ({ next, reason }: { next: AppSettings; reason: string }) =>
      settings.publish(next, reason),
  });
}

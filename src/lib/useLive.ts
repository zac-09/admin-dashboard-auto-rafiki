import { useEffect, useState } from 'react';

import type { Unsubscribe } from '@/types';

export type Live<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

const LOADING = { status: 'loading', data: undefined, error: undefined } as const;

/**
 * Subscribes while mounted and re-subscribes when `key` changes. `subscribe` must be a
 * repository listener (onChange, onError) → unsubscribe.
 */
export function useLive<T>(
  key: string,
  subscribe: (onChange: (data: T) => void, onError: (e: Error) => void) => Unsubscribe,
): Live<T> {
  const [state, setState] = useState<{ key: string; live: Live<T> }>({ key, live: LOADING });
  useEffect(
    () =>
      subscribe(
        (data) => setState({ key, live: { status: 'ready', data, error: undefined } }),
        (error) => setState({ key, live: { status: 'error', data: undefined, error } }),
      ),
    // `subscribe` is recreated every render; `key` says when the subscription really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return state.key === key ? state.live : LOADING;
}

/** The current time, ticking every `intervalMs` (elapsed-time labels, alert thresholds). */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

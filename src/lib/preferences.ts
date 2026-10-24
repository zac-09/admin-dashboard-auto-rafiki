import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Per-browser preferences: last tab, period and sort. Conveniences only, so storage that is
 * blocked or cleared (private windows) just means the defaults.
 */
const PREFIX = 'autorafiki.pref.';

export function readPreference<T>(key: string, fallback: T, valid?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid ? (valid(value) ? value : fallback) : (value as T);
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice simply is not remembered.
  }
}

/** useState that remembers its value in this browser. */
export function usePreference<T>(
  key: string,
  fallback: T,
  valid?: (v: unknown) => v is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPreference(key, fallback, valid));
  return [
    value,
    (next: T) => {
      setValue(next);
      writePreference(key, next);
    },
  ];
}

/**
 * Remembers a page's tab that lives in the URL (?view=…). Opening the page with no choice in
 * the URL restores the last one; a link that names a tab always wins.
 */
export function useRememberedParam(
  key: string,
  param: string,
  current: string,
  valid: readonly string[],
): void {
  const [params, setParams] = useSearchParams();
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) {
      writePreference(key, current);
      return;
    }
    restored.current = true;
    if (params.has(param)) {
      writePreference(key, current);
      return;
    }
    const last = readPreference<string | null>(key, null);
    if (last && last !== current && valid.includes(last)) {
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set(param, last);
          return next;
        },
        { replace: true },
      );
    }
    // Restores once on arrival, then records each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
}

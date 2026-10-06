import { env } from '@/lib/env';
import { createFirebaseRepositories } from '@/lib/firebase';
import { createMockRepositories } from '@/lib/mocks';
import type { Repositories } from '@/types';

let instance: Repositories | null = null;

/**
 * Single entry point for data access. Screens and hooks call this (or `useRepositories`)
 * and never import an implementation directly. Mocks unless VITE_USE_MOCKS=false.
 */
export function getRepositories(): Repositories {
  if (!instance) {
    instance = env.useMocks ? createMockRepositories() : createFirebaseRepositories();
  }
  return instance;
}

/** Test helper: swap the active repositories (null resets to the env default). */
export function setRepositoriesForTesting(repos: Repositories | null): void {
  instance = repos;
}

/** Hook form of `getRepositories()`. */
export function useRepositories(): Repositories {
  return getRepositories();
}

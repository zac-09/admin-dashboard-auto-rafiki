import type { Repositories } from '@/types';

import { MockAuthRepository } from './mockAuthRepository';

export * from './fixtures';

export function createMockRepositories(): Repositories {
  return { auth: new MockAuthRepository() };
}

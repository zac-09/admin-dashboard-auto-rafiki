import type { Repositories } from '@/types';

import { MockAuthRepository } from './mockAuthRepository';
import {
  MockAuditRepository,
  MockMechanicRepository,
  MockVettingRepository,
  MockVettingStore,
} from './mockVettingRepositories';

export * from './fixtures';

export function createMockRepositories(): Repositories {
  const auth = new MockAuthRepository();
  const store = new MockVettingStore();
  return {
    auth,
    mechanics: new MockMechanicRepository(store),
    audit: new MockAuditRepository(store),
    vetting: new MockVettingRepository(store, auth),
  };
}

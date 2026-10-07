import type { Repositories } from '@/types';

import { MockAuthRepository } from './mockAuthRepository';
import {
  MockOperationsRepository,
  MockOperationsStore,
  MockPeopleRepository,
} from './mockOperationsRepository';
import { MockRevenueRepository } from './mockRevenueRepository';
import { MockSettingsRepository } from './mockSettingsRepository';
import { MockStaffRepository } from './mockStaffRepository';
import { MockSupportRepository } from './mockSupportRepository';
import {
  MockAuditRepository,
  MockMechanicRepository,
  MockVettingRepository,
  MockVettingStore,
} from './mockVettingRepositories';

export * from './fixtures';

export { MockOperationsStore } from './mockOperationsRepository';

export function createMockRepositories(
  ops: MockOperationsStore = new MockOperationsStore(),
): Repositories {
  const auth = new MockAuthRepository();
  const store = new MockVettingStore();
  return {
    auth,
    mechanics: new MockMechanicRepository(store),
    audit: new MockAuditRepository(store),
    vetting: new MockVettingRepository(store, auth),
    operations: new MockOperationsRepository(ops, store),
    people: new MockPeopleRepository(store),
    support: new MockSupportRepository(ops, store, auth),
    revenue: new MockRevenueRepository(ops, store, auth),
    staff: new MockStaffRepository(auth),
    settings: new MockSettingsRepository(auth),
  };
}

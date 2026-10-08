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
import { MockVettingDocumentsRepository } from './mockVettingDocumentsRepository';
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
  const settings = new MockSettingsRepository(auth);
  const support = new MockSupportRepository(ops, store, auth);
  return {
    auth,
    mechanics: new MockMechanicRepository(store),
    audit: new MockAuditRepository(store),
    vetting: new MockVettingRepository(store, auth),
    operations: new MockOperationsRepository(ops, store, {
      actor: () => {
        const a = auth.current();
        return a ? { uid: a.uid, email: a.email, role: a.role } : null;
      },
      addNote: (note) => support.pushNote(note),
      settings: () => settings.current(),
    }),
    people: new MockPeopleRepository(store),
    support,
    revenue: new MockRevenueRepository(ops, store, auth),
    staff: new MockStaffRepository(auth),
    settings,
    vettingDocuments: new MockVettingDocumentsRepository(store, auth),
  };
}

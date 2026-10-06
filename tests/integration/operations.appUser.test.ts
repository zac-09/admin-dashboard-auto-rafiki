/** An app user (no role claim) cannot open the control room's collection-wide feeds. */
import { FirestoreOperationsRepository } from '../../src/lib/firebase/operationsRepository';
import type { Job } from '../../src/types';

import { nextMatching, signInOnce, signOutClient } from './opsHarness';

const repo = new FirestoreOperationsRepository();

beforeAll(() => signInOnce('appuser'));
afterAll(signOutClient);

it('an app user cannot subscribe to every active or closed job', async () => {
  await expect(
    nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      () => true,
    ),
  ).rejects.toMatchObject({ code: 'permission-denied' });
});

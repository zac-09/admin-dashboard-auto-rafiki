import { MOCK_PASSWORD } from '../fixtures';
import { MockAuthRepository } from '../mockAuthRepository';

describe('MockAuthRepository', () => {
  it('signs staff in with their role and notifies subscribers', async () => {
    const repo = new MockAuthRepository();
    const seen: (string | null)[] = [];
    const unsubscribe = repo.subscribe((s) => seen.push(s?.role ?? null));
    const session = await repo.signIn(' Ops@AutoRafiki.test ', MOCK_PASSWORD);
    expect(session.role).toBe('ops');
    await repo.signOut();
    unsubscribe();
    expect(seen).toEqual([null, 'ops', null]);
  });

  it('rejects a wrong password', async () => {
    await expect(new MockAuthRepository().signIn('admin@autorafiki.test', 'nope')).rejects.toThrow(
      /wrong email or password/i,
    );
  });

  it('signs an app user in without a dashboard role', async () => {
    const session = await new MockAuthRepository().signIn(
      'customer@autorafiki.test',
      MOCK_PASSWORD,
    );
    expect(session.role).toBeNull();
  });
});

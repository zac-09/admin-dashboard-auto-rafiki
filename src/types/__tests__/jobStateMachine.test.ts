import { assertTransition, canTransition, IllegalTransitionError, JOB_STATUSES } from '@/types';

// Ported from the app repo's src/features/jobs/__tests__/stateMachine.test.ts. The app's
// fourth case ("is enforced by the mock repository") exercises its mock JobRepository, which
// this repo does not have; the dashboard's interventions get their own tests in functions/.
describe('job state machine', () => {
  it('lets the mechanic walk the happy path and nothing else from terminal states', () => {
    expect(canTransition('requested', 'matched', 'mechanic')).toBe(true);
    expect(canTransition('matched', 'enroute', 'mechanic')).toBe(true);
    expect(canTransition('enroute', 'arrived', 'mechanic')).toBe(true);
    expect(canTransition('arrived', 'working', 'mechanic')).toBe(true);
    expect(canTransition('working', 'complete', 'mechanic')).toBe(true);
    for (const to of JOB_STATUSES) {
      expect(canTransition('complete', to, 'mechanic')).toBe(false);
      expect(canTransition('cancelled', to, 'customer')).toBe(false);
    }
  });

  it('forbids skipping ahead and going backwards', () => {
    expect(canTransition('matched', 'complete', 'mechanic')).toBe(false);
    expect(canTransition('working', 'enroute', 'mechanic')).toBe(false);
    expect(() => assertTransition('arrived', 'complete', 'mechanic')).toThrow(/cannot move/);
  });

  it('lets the customer cancel only before work starts', () => {
    expect(canTransition('requested', 'cancelled', 'customer')).toBe(true);
    expect(canTransition('enroute', 'cancelled', 'customer')).toBe(true);
    expect(canTransition('arrived', 'cancelled', 'customer')).toBe(false);
    expect(canTransition('matched', 'enroute', 'customer')).toBe(false);
  });

  // Dashboard additions: pin the full table so a drift from the app's copy fails loudly.
  it('matches the contract exactly, transition by transition', () => {
    const allowed = new Set([
      'mechanic:requested>matched',
      'mechanic:matched>enroute',
      'mechanic:matched>arrived',
      'mechanic:matched>cancelled',
      'mechanic:enroute>arrived',
      'mechanic:enroute>cancelled',
      'mechanic:arrived>working',
      'mechanic:working>complete',
      'customer:requested>cancelled',
      'customer:matched>cancelled',
      'customer:enroute>cancelled',
    ]);
    for (const by of ['mechanic', 'customer'] as const) {
      for (const from of JOB_STATUSES) {
        for (const to of JOB_STATUSES) {
          expect(canTransition(from, to, by), `${by}:${from}>${to}`).toBe(
            allowed.has(`${by}:${from}>${to}`),
          );
        }
      }
    }
  });

  it('throws a typed error carrying the illegal-transition code', () => {
    try {
      assertTransition('complete', 'cancelled', 'customer');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalTransitionError);
      expect((error as IllegalTransitionError).code).toBe('illegal-transition');
    }
  });
});

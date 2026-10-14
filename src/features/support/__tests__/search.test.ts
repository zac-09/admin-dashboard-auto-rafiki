import { createMockRepositories, MockOperationsStore } from '@/lib/mocks';

import { normalisePlate } from '@/lib/plate';

import { normalizeUgPhone, search } from '../search';

describe('normalizeUgPhone', () => {
  it.each([
    ['0772123456', '+256772123456'],
    ['0772 123 456', '+256772123456'],
    ['772123456', '+256772123456'],
    ['256772123456', '+256772123456'],
    ['+256 772-123-456', '+256772123456'],
    ['(0701) 987654', '+256701987654'],
  ])('%s → %s', (input, out) => {
    expect(normalizeUgPhone(input)).toBe(out);
  });

  it.each(['0412123456', '07721234', '+254712345678', 'Okello', ''])('rejects %j', (input) => {
    expect(normalizeUgPhone(input)).toBeNull();
  });
});

describe('search', () => {
  const repos = () => createMockRepositories(new MockOperationsStore());

  it('finds a customer and a mechanic by phone however it is typed', async () => {
    const r = await search(repos().support, '0701 987 654');
    expect(r.people.map((u) => u.id)).toEqual(['u_mech_okello']);
    expect(r.mechanics.map((m) => m.businessName)).toEqual(['Okello Auto Rescue']);
    expect(r.jobs).toEqual([]);
  });

  it('finds a job by id', async () => {
    const r = await search(repos().support, ' job_enroute_late ');
    expect(r.jobs.map((j) => j.id)).toEqual(['job_enroute_late']);
  });

  it('finds mechanics by any part of the business name, ignoring case', async () => {
    const r = await search(repos().support, 'motors');
    expect(r.mechanics.map((m) => m.businessName)).toEqual(['Namukasa Motors']);
    const fix = await search(repos().support, 'FIX');
    expect(fix.mechanics.map((m) => m.businessName)).toEqual(['Ssempala Boda Fix']);
  });

  it('finds jobs by number plate however it is typed', async () => {
    const r = await search(repos().support, 'uba 123x');
    expect(r.jobs.map((j) => j.id)).toEqual(['job_enroute_late']);
    expect((await search(repos().support, 'UBA999Z')).jobs).toEqual([]);
  });

  it('does nothing for a one-character query', async () => {
    const r = await search(repos().support, 'o');
    expect(r).toEqual({ query: 'o', jobs: [], people: [], mechanics: [] });
  });
});

describe('normalisePlate (mirrors the app)', () => {
  it.each([
    ['uba 123x', 'UBA123X'],
    ['UG 1234A', 'UG1234A'],
    ['  ueb123a ', 'UEB123A'],
  ])('%s → %s', (input, out) => {
    expect(normalisePlate(input)).toBe(out);
  });

  it.each(['', 'X', 'UBA-123X', 'ABCDEFGHIJK'])('rejects %j', (input) => {
    expect(normalisePlate(input)).toBeUndefined();
  });
});

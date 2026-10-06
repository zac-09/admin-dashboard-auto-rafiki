import type { Job, MechanicDoc, SupportRepository, UgPhone, UserDoc } from '@/types';

/**
 * A Ugandan mobile number in any of the ways people type it, as E.164 (+2567XXXXXXXX):
 * "0772 123 456", "772123456", "256772123456", "+256 772-123-456". Null if it isn't one.
 */
export function normalizeUgPhone(input: string): UgPhone | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?256|0)?(7\d{8})$/.exec(digits);
  return m ? (`+256${m[1]}` as UgPhone) : null;
}

/** Case- and accent-insensitive "contains". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SearchResults {
  query: string;
  jobs: Job[];
  people: UserDoc[];
  mechanics: MechanicDoc[];
}

export const MIN_QUERY = 2;

/**
 * One box for phone, job id and business name (CLAUDE.md: plate search waits for the plate
 * field). Phones match exactly on users and mechanics; anything id-shaped is tried as a job id;
 * names match anywhere in the business name.
 */
export async function search(repo: SupportRepository, raw: string): Promise<SearchResults> {
  const q = raw.trim();
  const empty: SearchResults = { query: q, jobs: [], people: [], mechanics: [] };
  if (q.length < MIN_QUERY) return empty;

  const phone = normalizeUgPhone(q);
  const idShaped = /^[A-Za-z0-9_-]{4,}$/.test(q) && !phone;
  const [byPhone, job, all] = await Promise.all([
    phone ? repo.findByPhone(phone) : Promise.resolve({ users: [], mechanics: [] }),
    idShaped ? repo.findJob(q) : Promise.resolve(null),
    phone ? Promise.resolve([] as MechanicDoc[]) : repo.listMechanics(),
  ]);

  const needle = fold(q);
  const byName = all.filter((m) => fold(m.businessName).includes(needle));
  const mechanics = new Map<string, MechanicDoc>();
  for (const m of [...byPhone.mechanics, ...byName]) mechanics.set(m.userId, m);

  return {
    query: q,
    jobs: job ? [job] : [],
    people: byPhone.users,
    mechanics: [...mechanics.values()].sort((a, b) => a.businessName.localeCompare(b.businessName)),
  };
}

export function resultCount(r: SearchResults): number {
  return r.jobs.length + r.people.length + r.mechanics.length;
}

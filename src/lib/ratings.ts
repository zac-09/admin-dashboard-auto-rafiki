import type { Rating, UserRole } from '@/types';

/** Ported from the app: early ratings had no `ratedBy` and were all customer → mechanic. */
export function ratedBy(rating: Pick<Rating, 'ratedBy'>): UserRole {
  return rating.ratedBy ?? 'customer';
}

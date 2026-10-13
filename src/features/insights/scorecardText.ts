import type { Scorecard } from './scorecard';

const oneDp = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export function ratingText(s: Scorecard): string {
  if (s.rating.recent === null) return 'No ratings in 30 days';
  return `★ ${oneDp(s.rating.recent)} (${s.rating.recentCount})`;
}

export function trendText(s: Scorecard): string | null {
  switch (s.ratingTrend) {
    case 'up':
      return `up from ${oneDp(s.rating.previous!)}`;
    case 'down':
      return `down from ${oneDp(s.rating.previous!)}`;
    case 'steady':
      return 'steady';
    default:
      return null;
  }
}

export function lateText(s: Scorecard): string {
  if (s.medianLateMin === null) return '–';
  const m = Math.round(s.medianLateMin);
  return m > 0 ? `${m} min late` : m < 0 ? `${-m} min early` : 'on time';
}

export function cancelText(s: Scorecard): string {
  if (s.cancelShare === null) return '–';
  return `${s.mechanicCancels} of ${s.accepted} (${Math.round(s.cancelShare * 100)}%)`;
}

export function minutesText(v: number | null): string {
  return v === null ? '–' : `${Math.round(v)} min`;
}

export { oneDp };

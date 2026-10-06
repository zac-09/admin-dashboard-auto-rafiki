import { SERVICE_LABELS, VEHICLE_LABELS } from '@/lib/labels';
import type { MechanicDoc } from '@/types';

export function servicesText(m: MechanicDoc): string {
  return m.services.map((s) => SERVICE_LABELS[s] ?? s).join(', ') || 'None listed';
}

export function vehiclesText(m: MechanicDoc): string {
  return m.vehicles.map((v) => VEHICLE_LABELS[v] ?? v).join(', ') || 'None listed';
}

export function ratingText(m: MechanicDoc): string {
  return m.ratingCount > 0
    ? `${m.ratingAverage.toFixed(1)} (${m.ratingCount} ${m.ratingCount === 1 ? 'rating' : 'ratings'})`
    : 'No ratings yet';
}

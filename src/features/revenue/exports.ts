import { toCsv } from '@/lib/csv';
import { SERVICE_LABELS, VEHICLE_LABELS } from '@/lib/labels';
import { weekLabel, type WeekSummary } from '@/lib/subscriptions';
import { PAYMENT_METHOD_LABELS, type Job } from '@/types';

/** One row per job: what reporting asks for most (ids kept for cross-referencing). */
export function jobsCsv(jobs: readonly Job[], mechanicNames: Map<string, string>): string {
  const at = (j: Job, s: Job['status']) => j.timeline.find((t) => t.status === s)?.at ?? '';
  return toCsv(
    [
      'Job id',
      'Requested at',
      'Status',
      'Service',
      'Vehicle',
      'Location',
      'Fee (UGX)',
      'Mechanic',
      'Mechanic id',
      'Customer id',
      'Matched at',
      'Arrived at',
      'Completed at',
      'Cancelled by',
      'Distance driven (km)',
      'Broadcast radius (km)',
    ],
    jobs.map((j) => [
      j.id,
      j.request.createdAt,
      j.status,
      SERVICE_LABELS[j.request.service],
      VEHICLE_LABELS[j.request.vehicle],
      j.request.location.label,
      j.fee,
      j.mechanicId ? (mechanicNames.get(j.mechanicId) ?? '') : '',
      j.mechanicId ?? '',
      j.request.customerId,
      at(j, 'matched'),
      at(j, 'arrived'),
      at(j, 'complete'),
      j.cancelledBy ?? '',
      j.distanceKm ?? '',
      j.radiusKm,
    ]),
  );
}

/** One row per mechanic per week: owed, status, and the payment when recorded. */
export function subscriptionsCsv(weeks: readonly WeekSummary[]): string {
  return toCsv(
    [
      'Week starting',
      'Week',
      'Mechanic',
      'Mechanic id',
      'Phone',
      'Status',
      'Amount due (UGX)',
      'Amount paid (UGX)',
      'Paid at',
      'Method',
      'Reference',
      'Recorded by',
    ],
    weeks.flatMap((w) =>
      w.rows.map((r) => [
        w.weekStart,
        weekLabel(w.weekStart),
        r.mechanic.businessName,
        r.mechanic.userId,
        r.mechanic.phone ?? '',
        r.status,
        w.expected / Math.max(w.rows.length, 1),
        r.payment?.amount ?? 0,
        r.payment?.paidAt ?? '',
        r.payment ? PAYMENT_METHOD_LABELS[r.payment.method] : '',
        r.payment?.reference ?? '',
        r.payment?.recordedByEmail ?? '',
      ]),
    ),
  );
}

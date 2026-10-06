import type { MechanicProfile, ServiceType, VehicleCategory } from '../types/domain';

/** Ported from the app's src/features/jobs/labels.ts so both sides use the same words. */
export const SERVICE_LABELS: Record<ServiceType, string> = {
  'flat-tyre': 'Flat tyre',
  battery: 'Dead battery',
  engine: 'Engine trouble',
  fuel: 'Out of fuel',
  lockout: 'Locked out',
  towing: 'Towing',
  other: 'Other',
};

export const VEHICLE_LABELS: Record<VehicleCategory, string> = {
  car: 'Car',
  boda: 'Boda',
  truck: 'Truck',
  matatu: 'Matatu',
};

export const VETTING_LABELS: Record<MechanicProfile['vetting'], string> = {
  pending: 'Pending',
  verified: 'Verified',
  suspended: 'Suspended',
};

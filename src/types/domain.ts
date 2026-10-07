/**
 * MIRRORED from the app repo (auto-rafiki) src/types/domain.ts. Keep this file verbatim below
 * this header: the app is the source of truth for the shared data model. To change it, change
 * the app first and re-copy. Fields the app writes to Firestore but leaves out of these types
 * live in ./firestore.ts.
 */

/** ISO-8601 timestamp string. */
export type IsoDate = string;

/** Whole Ugandan shillings; never fractional. Format with `formatUgx`. */
export type Ugx = number;

/** E.164 Ugandan number, e.g. "+256772123456". */
export type UgPhone = `+256${string}`;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Place extends GeoPoint {
  /** Human label, e.g. "Kampala Road, near Cham Towers". */
  label: string;
}

export type UserRole = 'customer' | 'mechanic';

export interface User {
  id: string;
  phone: UgPhone;
  displayName: string;
  /** A user can hold both roles; `activeRole` drives which mode the app opens. */
  roles: UserRole[];
  activeRole: UserRole;
  createdAt: IsoDate;
}

/** The little a user shows to the other side of a job (users/{uid} itself is private). */
export interface PublicProfile {
  id: string;
  displayName: string;
  /** How mechanics have rated this customer (aggregated by Cloud Function; absent until rated). */
  ratingAverage?: number;
  ratingCount?: number;
}

export type VehicleCategory = 'car' | 'boda' | 'truck' | 'matatu';

export type ServiceType =
  'flat-tyre' | 'battery' | 'engine' | 'fuel' | 'lockout' | 'towing' | 'other';

export interface MechanicProfile {
  userId: string;
  businessName: string;
  /** Public contact number shown to the matched customer (users/{uid} is private). */
  phone?: UgPhone;
  services: ServiceType[];
  vehicles: VehicleCategory[];
  /** Rolling average, 0–5. */
  ratingAverage: number;
  ratingCount: number;
  jobsCompleted: number;
  /** Vetting status shown as a badge; only `verified` mechanics receive alerts. */
  vetting: 'pending' | 'verified' | 'suspended';
  isOnline: boolean;
  lastKnownLocation?: Place;
  /** Standard call-out fee in UGX; final price is agreed on site in v1. */
  calloutFee: Ugx;
  /** When the mechanics doc was first created (ISO). Set once, never overwritten. */
  createdAt?: IsoDate;
}

export interface JobRequest {
  id: string;
  customerId: string;
  location: Place;
  vehicle: VehicleCategory;
  service: ServiceType;
  description: string;
  createdAt: IsoDate;
}

export type JobStatus =
  'requested' | 'matched' | 'enroute' | 'arrived' | 'working' | 'complete' | 'cancelled';

export const JOB_STATUSES: readonly JobStatus[] = [
  'requested',
  'matched',
  'enroute',
  'arrived',
  'working',
  'complete',
  'cancelled',
];

export interface JobTimelineEntry {
  status: JobStatus;
  at: IsoDate;
}

/** Broadcast dispatch (CLAUDE.md v2): first mechanic to accept wins. */
/**
 * settings/app: ops-tunable values the dashboard writes (through an audited admin Cloud
 * Function) and the app only reads. See lib/settings for the schema and the fallback.
 */
export interface AppSettings {
  version: 1;
  /** Upfront call-out price per fault, whole UGX. */
  prices: Record<ServiceType, Ugx>;
  broadcast: {
    /** First broadcast radius. */
    initialRadiusKm: number;
    /** The one widening after a window passes. */
    expandedRadiusKm: number;
    /** Length of each broadcast window. */
    windowMs: number;
  };
  updatedAt?: IsoDate;
  updatedBy?: string;
}

/** Where the active settings came from: the validated document, or the compiled defaults. */
export type SettingsSource = 'remote' | 'default';

/**
 * The price and broadcast terms a request is created with, taken from ONE settings snapshot
 * (the one the customer was shown), so the stored fee always equals the displayed price.
 */
export interface RequestTerms {
  fee: Ugx;
  radiusKm: number;
  windowMs: number;
}

/** Compiled defaults (settings fallback). Read through lib/settings, never directly. */
export const BROADCAST = {
  initialRadiusKm: 5,
  expandedRadiusKm: 8,
  /** Each broadcast window before the radius expands / the request gives up. */
  windowMs: 90_000,
} as const;

export interface Job {
  id: string;
  request: JobRequest;
  status: JobStatus;
  /** Broadcast radius around the request; expands once on timeout. */
  radiusKm: number;
  /** End of the current broadcast window (ISO). */
  expiresAt: IsoDate;
  /** Set once matched. */
  mechanicId?: string;
  /** Agreed/settled fee, UGX. Payment settles directly customer → mechanic in v1. */
  fee: Ugx;
  etaMinutes?: number;
  /** Kilometres the mechanic actually drove to the customer, recorded on arrival. */
  distanceKm?: number;
  timeline: JobTimelineEntry[];
  /**
   * Who cancelled: either party, 'system' when the broadcast expired server-side, or
   * 'admin' when AutoRafiki operations cancelled it from the dashboard.
   */
  cancelledBy?: UserRole | 'system' | 'admin';
}

export interface Rating {
  id: string;
  jobId: string;
  /** Both parties on the job; `ratedBy` says which one gave the stars. */
  mechanicId: string;
  customerId: string;
  /** Who gave the rating. Absent on early documents, which were all customer → mechanic. */
  ratedBy?: UserRole;
  /** 1–5. */
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: IsoDate;
}

export type EarningsPeriod = 'today' | 'week' | 'month';

export interface Earnings {
  mechanicId: string;
  period: EarningsPeriod;
  total: Ugx;
  jobsCompleted: number;
  /** Per-job breakdown, newest first. */
  items: EarningsItem[];
}

export interface EarningsItem {
  jobId: string;
  completedAt: IsoDate;
  fee: Ugx;
  service: ServiceType;
  locationLabel: string;
  /** Minutes from arrival to completion, when both are known. */
  minutes?: number;
  /** Kilometres driven to the job, when recorded. */
  distanceKm?: number;
}

/**
 * App presence (is the person's app open right now), for the chat header. Not the same as a
 * mechanic's `isOnline` (available for jobs). Refreshed by a heartbeat while the app is in
 * the foreground; a killed app simply goes stale and reads as "last seen".
 */
export interface Presence {
  userId: string;
  /** App in the foreground at the last heartbeat. */
  online: boolean;
  /** Last heartbeat (server time). */
  lastSeen: IsoDate | null;
  /** The job whose chat is open on screen, so message pushes can be skipped. */
  viewingJobId: string | null;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: IsoDate;
}

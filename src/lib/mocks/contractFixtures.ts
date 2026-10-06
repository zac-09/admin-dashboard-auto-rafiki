import type {
  ChatMessage,
  Job,
  JobStatus,
  JobTimelineEntry,
  MechanicDoc,
  Place,
  Rating,
  ServiceType,
  UserDoc,
  VehicleCategory,
} from '@/types';

import { APP_CALLOUT_PRICES } from '@/lib/pricing';

/**
 * Fixtures shaped exactly like the documents the app writes (see the data contract in
 * CLAUDE.md). Tests in __tests__/contractFixtures.test.ts enforce the invariants.
 * Times are relative to FIXTURE_NOW so "elapsed" and "stale" views have something to show.
 */
export const FIXTURE_NOW = new Date('2026-10-06T09:00:00.000Z');

const minutesAgo = (m: number) => new Date(FIXTURE_NOW.getTime() - m * 60_000).toISOString();
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

export const PLACES = {
  kampalaRoad: { latitude: 0.3136, longitude: 32.5811, label: 'Kampala Road, near Cham Towers' },
  ntinda: { latitude: 0.3538, longitude: 32.6157, label: 'Ntinda Shopping Centre' },
  kololo: { latitude: 0.3339, longitude: 32.5931, label: 'Kololo, Acacia Avenue' },
  bugolobi: { latitude: 0.3157, longitude: 32.6202, label: 'Bugolobi, Village Mall' },
  nakawa: { latitude: 0.3306, longitude: 32.6188, label: 'Nakawa, Jinja Road' },
  wandegeya: { latitude: 0.3365, longitude: 32.5707, label: 'Wandegeya roundabout' },
  kabalagala: { latitude: 0.2963, longitude: 32.5983, label: 'Kabalagala, Ggaba Road' },
  makerere: { latitude: 0.3359, longitude: 32.5665, label: 'Makerere University main gate' },
} satisfies Record<string, Place>;

export const USERS: UserDoc[] = [
  {
    id: 'u_customer_aisha',
    phone: '+256772123456',
    displayName: 'Aisha Nakato',
    roles: ['customer'],
    activeRole: 'customer',
    createdAt: daysAgo(66),
  },
  {
    id: 'u_customer_brian',
    phone: '+256783555010',
    displayName: 'Brian Mugisha',
    roles: ['customer'],
    activeRole: 'customer',
    createdAt: daysAgo(20),
  },
  {
    id: 'u_mech_okello',
    phone: '+256701987654',
    displayName: 'Moses Okello',
    roles: ['mechanic', 'customer'],
    activeRole: 'mechanic',
    createdAt: daysAgo(83),
  },
  {
    id: 'u_mech_namukasa',
    phone: '+256752400200',
    displayName: 'Grace Namukasa',
    roles: ['customer', 'mechanic'],
    activeRole: 'mechanic',
    createdAt: daysAgo(40),
  },
  {
    id: 'u_mech_ssempala',
    phone: '+256774300300',
    displayName: 'Joseph Ssempala',
    roles: ['customer', 'mechanic'],
    activeRole: 'mechanic',
    createdAt: daysAgo(3),
  },
  {
    id: 'u_mech_kato',
    phone: '+256705600600',
    displayName: 'Peter Kato',
    roles: ['customer', 'mechanic'],
    activeRole: 'mechanic',
    createdAt: daysAgo(1),
  },
  {
    id: 'u_mech_waiswa',
    phone: '+256789700700',
    displayName: 'David Waiswa',
    roles: ['customer', 'mechanic'],
    activeRole: 'mechanic',
    createdAt: daysAgo(120),
  },
];

function phoneOf(id: string): UserDoc['phone'] {
  const user = USERS.find((u) => u.id === id);
  if (!user) throw new Error(`No fixture user ${id}`);
  return user.phone;
}

export const MECHANICS: MechanicDoc[] = [
  {
    userId: 'u_mech_okello',
    businessName: 'Okello Auto Rescue',
    phone: phoneOf('u_mech_okello'),
    services: ['flat-tyre', 'battery', 'engine', 'fuel', 'towing'],
    vehicles: ['car', 'matatu', 'boda'],
    ratingAverage: 4.8,
    ratingCount: 132,
    jobsCompleted: 148,
    vetting: 'verified',
    isOnline: true,
    lastKnownLocation: { ...PLACES.kololo, label: 'Live location' },
    locationUpdatedAt: minutesAgo(0.1),
    calloutFee: 30_000,
  },
  {
    userId: 'u_mech_namukasa',
    businessName: 'Namukasa Motors',
    phone: phoneOf('u_mech_namukasa'),
    services: ['flat-tyre', 'battery', 'lockout'],
    vehicles: ['car'],
    ratingAverage: 4.5,
    ratingCount: 41,
    jobsCompleted: 52,
    vetting: 'verified',
    isOnline: true,
    lastKnownLocation: { ...PLACES.nakawa, label: 'Live location' },
    locationUpdatedAt: minutesAgo(0.2),
    calloutFee: 25_000,
  },
  {
    userId: 'u_mech_ssempala',
    businessName: 'Ssempala Boda Fix',
    phone: phoneOf('u_mech_ssempala'),
    services: ['flat-tyre', 'engine', 'fuel'],
    vehicles: ['boda'],
    ratingAverage: 0,
    ratingCount: 0,
    jobsCompleted: 0,
    vetting: 'pending',
    isOnline: false,
    lastKnownLocation: PLACES.wandegeya,
    calloutFee: 15_000,
  },
  {
    userId: 'u_mech_kato',
    businessName: 'Kato Battery & Tyre',
    phone: phoneOf('u_mech_kato'),
    services: ['battery', 'flat-tyre'],
    vehicles: ['car', 'matatu'],
    ratingAverage: 0,
    ratingCount: 0,
    jobsCompleted: 0,
    vetting: 'pending',
    isOnline: false,
    calloutFee: 20_000,
  },
  {
    userId: 'u_mech_waiswa',
    businessName: 'Waiswa Heavy Recovery',
    phone: phoneOf('u_mech_waiswa'),
    services: ['towing', 'engine'],
    vehicles: ['truck', 'car'],
    ratingAverage: 2.1,
    ratingCount: 9,
    jobsCompleted: 11,
    vetting: 'suspended',
    isOnline: false,
    lastKnownLocation: PLACES.kabalagala,
    calloutFee: 60_000,
  },
];

/** Builds a job the way the app does: fee from the compiled price, timeline per transition. */
function job(input: {
  id: string;
  customerId: string;
  location: Place;
  vehicle: VehicleCategory;
  service: ServiceType;
  description: string;
  /** Status walk after 'requested' with minutes-ago timestamps, oldest first. */
  steps?: [JobStatus, number][];
  requestedMinutesAgo: number;
  mechanicId?: string;
  radiusKm?: 5 | 8;
  cancelledBy?: Job['cancelledBy'];
  distanceKm?: number;
  etaMinutes?: number;
}): Job {
  const createdAt = minutesAgo(input.requestedMinutesAgo);
  const timeline: JobTimelineEntry[] = [
    { status: 'requested', at: createdAt },
    ...(input.steps ?? []).map(([status, m]) => ({ status, at: minutesAgo(m) })),
  ];
  const status = timeline[timeline.length - 1]!.status;
  const result: Job = {
    id: input.id,
    request: {
      id: input.id,
      customerId: input.customerId,
      location: input.location,
      vehicle: input.vehicle,
      service: input.service,
      description: input.description,
      createdAt,
    },
    status,
    radiusKm: input.radiusKm ?? 5,
    expiresAt: new Date(new Date(createdAt).getTime() + 90_000).toISOString(),
    fee: APP_CALLOUT_PRICES[input.service],
    timeline,
  };
  if (input.mechanicId) result.mechanicId = input.mechanicId;
  if (input.cancelledBy) result.cancelledBy = input.cancelledBy;
  if (input.distanceKm != null) result.distanceKm = input.distanceKm;
  if (input.etaMinutes != null) result.etaMinutes = input.etaMinutes;
  return result;
}

export const JOBS: Job[] = [
  // Stale request: no acceptance for 4 min (alert rail).
  job({
    id: 'job_req_stale',
    customerId: 'u_customer_brian',
    location: PLACES.ntinda,
    vehicle: 'car',
    service: 'battery',
    description: 'Car will not start outside the supermarket.',
    requestedMinutesAgo: 4,
    radiusKm: 8,
  }),
  job({
    id: 'job_enroute_late',
    customerId: 'u_customer_aisha',
    location: PLACES.bugolobi,
    vehicle: 'car',
    service: 'flat-tyre',
    description: 'Rear left puncture, no spare.',
    requestedMinutesAgo: 41,
    steps: [
      ['matched', 40],
      ['enroute', 38],
    ],
    mechanicId: 'u_mech_namukasa',
  }),
  job({
    id: 'job_working',
    customerId: 'u_customer_brian',
    location: PLACES.kampalaRoad,
    vehicle: 'matatu',
    service: 'engine',
    description: 'Overheating, steam from the bonnet.',
    requestedMinutesAgo: 55,
    steps: [
      ['matched', 54],
      ['enroute', 53],
      ['arrived', 35],
      ['working', 33],
    ],
    mechanicId: 'u_mech_okello',
    distanceKm: 6.2,
  }),
  job({
    id: 'job_complete',
    customerId: 'u_customer_aisha',
    location: PLACES.nakawa,
    vehicle: 'car',
    service: 'battery',
    description: 'Lights dim, will not crank.',
    requestedMinutesAgo: 60 * 26,
    steps: [
      ['matched', 60 * 26 - 1],
      ['enroute', 60 * 26 - 2],
      ['arrived', 60 * 26 - 21],
      ['working', 60 * 26 - 23],
      ['complete', 60 * 26 - 50],
    ],
    mechanicId: 'u_mech_okello',
    distanceKm: 3.4,
  }),
  job({
    id: 'job_cancelled_customer',
    customerId: 'u_customer_aisha',
    location: PLACES.kabalagala,
    vehicle: 'boda',
    service: 'fuel',
    description: 'Ran out of fuel near Ggaba Road.',
    requestedMinutesAgo: 60 * 50,
    steps: [['cancelled', 60 * 50 - 4]],
    cancelledBy: 'customer',
  }),
  job({
    id: 'job_cancelled_system',
    customerId: 'u_customer_brian',
    location: PLACES.makerere,
    vehicle: 'car',
    service: 'lockout',
    description: 'Keys locked inside.',
    requestedMinutesAgo: 60 * 30,
    steps: [['cancelled', 60 * 30 - 5]],
    radiusKm: 8,
    cancelledBy: 'system',
  }),
];

export const RATINGS: Rating[] = [
  {
    id: 'rating_c2m',
    jobId: 'job_complete',
    mechanicId: 'u_mech_okello',
    customerId: 'u_customer_aisha',
    stars: 5,
    comment: 'Came fast, fixed the battery terminal in minutes.',
    createdAt: minutesAgo(60 * 26 - 55),
  },
  {
    id: 'rating_m2c',
    jobId: 'job_complete',
    mechanicId: 'u_mech_okello',
    customerId: 'u_customer_aisha',
    ratedBy: 'mechanic',
    stars: 2,
    comment: 'Wrong pin, took a while to find.',
    createdAt: minutesAgo(60 * 26 - 56),
  },
];

export const MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    jobId: 'job_enroute_late',
    senderId: 'u_customer_aisha',
    senderRole: 'customer',
    text: 'Are you close?',
    createdAt: minutesAgo(12),
  },
  {
    id: 'msg_2',
    jobId: 'job_enroute_late',
    senderId: 'u_mech_namukasa',
    senderRole: 'mechanic',
    text: 'Traffic at the Jinja Road lights, ten minutes.',
    createdAt: minutesAgo(11),
  },
];

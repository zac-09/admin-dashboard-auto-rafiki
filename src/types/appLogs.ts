import type { AvailabilityEvent, BroadcastOffer } from './domain';

/** An availability log entry with the mechanic it belongs to (mechanics/{uid}/availability). */
export type AvailabilityRecord = AvailabilityEvent & { mechanicId: string };
/** A broadcast offer with its job (jobs/{jobId}/offers/{mechanicId}). */
export type OfferRecord = BroadcastOffer & { jobId: string };

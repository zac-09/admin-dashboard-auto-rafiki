import type { Repositories } from '@/types';

import { FirebaseAuthRepository } from './firebaseAuthRepository';
import {
  CallableVettingRepository,
  FirestoreAuditRepository,
  FirestoreMechanicRepository,
} from './firestoreRepositories';
import { FirestoreOperationsRepository, FirestorePeopleRepository } from './operationsRepository';
import { FirestoreRevenueRepository } from './revenueRepository';
import { FirestoreSettingsRepository } from './settingsRepository';
import { FirebaseVettingDocumentsRepository } from './vettingDocumentsRepository';
import { CallableStaffRepository } from './staffRepository';
import { FirestoreSupportRepository } from './supportRepository';

export function createFirebaseRepositories(): Repositories {
  return {
    auth: new FirebaseAuthRepository(),
    mechanics: new FirestoreMechanicRepository(),
    audit: new FirestoreAuditRepository(),
    vetting: new CallableVettingRepository(),
    operations: new FirestoreOperationsRepository(),
    people: new FirestorePeopleRepository(),
    support: new FirestoreSupportRepository(),
    revenue: new FirestoreRevenueRepository(),
    staff: new CallableStaffRepository(),
    settings: new FirestoreSettingsRepository(),
    vettingDocuments: new FirebaseVettingDocumentsRepository(),
  };
}

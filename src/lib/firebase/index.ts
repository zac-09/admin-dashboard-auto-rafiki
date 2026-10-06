import type { Repositories } from '@/types';

import { FirebaseAuthRepository } from './firebaseAuthRepository';
import {
  CallableVettingRepository,
  FirestoreAuditRepository,
  FirestoreMechanicRepository,
} from './firestoreRepositories';

export function createFirebaseRepositories(): Repositories {
  return {
    auth: new FirebaseAuthRepository(),
    mechanics: new FirestoreMechanicRepository(),
    audit: new FirestoreAuditRepository(),
    vetting: new CallableVettingRepository(),
  };
}

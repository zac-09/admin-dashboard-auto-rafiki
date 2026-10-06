import type { Repositories } from '@/types';

import { FirebaseAuthRepository } from './firebaseAuthRepository';

export function createFirebaseRepositories(): Repositories {
  return { auth: new FirebaseAuthRepository() };
}

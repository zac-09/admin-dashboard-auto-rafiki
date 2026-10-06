/**
 * AutoRafiki dashboard Cloud Functions: codebase "admin" (firebase.json). The app repo owns
 * codebase "default" (onJobCreated, onJobStatusChanged, onMessageCreated, onRatingCreated,
 * expireStaleRequests); never deploy into it.
 *
 * - setUserRole: admin-only callable that sets a staff member's `role` claim (audited)
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';

import { AUDIT_COLLECTION } from '../../src/types/audit';

import { setUserRole as setUserRoleHandler, type RoleDeps } from './setUserRole';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

const isAuthError = (error: unknown, code: string) =>
  (error as { code?: string })?.code === `auth/${code}`;

const roleDeps: RoleDeps = {
  async findAccount(by) {
    try {
      const user =
        'uid' in by ? await getAuth().getUser(by.uid) : await getAuth().getUserByEmail(by.email);
      return {
        uid: user.uid,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        customClaims: user.customClaims ?? {},
      };
    } catch (error) {
      if (isAuthError(error, 'user-not-found')) return null;
      throw error;
    }
  },
  setClaims: (uid, claims) => getAuth().setCustomUserClaims(uid, claims),
  revokeTokens: (uid) => getAuth().revokeRefreshTokens(uid),
  async writeAudit(entry) {
    await getFirestore().collection(AUDIT_COLLECTION).add(entry);
  },
  now: () => new Date(),
};

export const setUserRole = onCall((request) =>
  setUserRoleHandler(
    request.auth
      ? {
          uid: request.auth.uid,
          email: (request.auth.token.email as string | undefined) ?? null,
          role: request.auth.token.role,
        }
      : null,
    request.data,
    roleDeps,
  ),
);

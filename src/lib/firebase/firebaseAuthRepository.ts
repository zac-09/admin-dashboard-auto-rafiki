import {
  getAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';

import { isAdminRole, type AdminSession, type AuthRepository, type Unsubscribe } from '@/types';

import { getFirebaseApp } from './app';

const auth = () => getAuth(getFirebaseApp());

/** The `role` custom claim decides dashboard access; app (phone) users have none. */
async function toSession(user: FirebaseUser, forceRefresh = false): Promise<AdminSession> {
  const token = await user.getIdTokenResult(forceRefresh);
  const role = token.claims.role;
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    role: isAdminRole(role) ? role : null,
  };
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account is disabled. Ask an admin.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
};

function friendly(error: unknown): Error {
  const code = (error as { code?: string })?.code ?? '';
  return Object.assign(new Error(MESSAGES[code] ?? 'Sign-in failed. Try again.'), { code });
}

export class FirebaseAuthRepository implements AuthRepository {
  async signIn(email: string, password: string): Promise<AdminSession> {
    try {
      const credential = await signInWithEmailAndPassword(auth(), email.trim(), password);
      // Fresh token so a role granted moments ago is seen immediately.
      return await toSession(credential.user, true);
    } catch (error) {
      throw friendly(error);
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth());
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth(), email.trim());
    } catch (error) {
      throw friendly(error);
    }
  }

  subscribe(onChange: (session: AdminSession | null) => void): Unsubscribe {
    // Token changes (sign-in, sign-out, hourly refresh) carry the latest role claim.
    return onIdTokenChanged(auth(), (user) => {
      if (!user) return onChange(null);
      toSession(user).then(onChange, () => onChange(null));
    });
  }
}

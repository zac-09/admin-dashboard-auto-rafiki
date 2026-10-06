/**
 * Shared setup for tests that drive the dashboard's own Firestore operations repository on
 * the emulators. One identity per test file: each file gets a fresh Firebase client.
 *
 * Node-only quirk: the web SDK's gRPC Listen stream intermittently desyncs against the
 * emulator (no updates, bogus RESOURCE_EXHAUSTED "message larger than max"), mostly when a
 * listener is open while a write lands. So these tests sign in once, make a one-off read, and
 * write BEFORE subscribing. Browsers use WebChannel and are unaffected; live updates are
 * verified in real Chrome by `npm run test:e2e`.
 */
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

import { env } from '../../src/lib/env';
import { EMULATOR_PROJECT_ID, getFirebaseApp } from '../../src/lib/firebase/app';
import { JOBS } from '../../src/lib/mocks/contractFixtures';
import type { Job } from '../../src/types';

import { restWrite } from './emulatorRest';

// These files drive the dashboard's own Firebase client: it must only ever talk to emulators.
if (!env.useEmulators || getFirebaseApp().options.projectId !== EMULATOR_PROJECT_ID) {
  throw new Error('Refusing to run: the dashboard client is not pointed at the emulators.');
}

const PASSWORD = 'password123';

/** Creates the account (claims via the Admin SDK's Auth, which is REST), signs in, warms up. */
export async function signInOnce(uid: string, role?: string): Promise<void> {
  const admin = initializeApp({ projectId: EMULATOR_PROJECT_ID }, `harness-${uid}`);
  const email = `${uid}@autorafiki.test`;
  await adminAuth(admin)
    .deleteUser(uid)
    .catch(() => undefined);
  await adminAuth(admin).createUser({ uid, email, password: PASSWORD });
  if (role) await adminAuth(admin).setCustomUserClaims(uid, { role });
  await deleteApp(admin);
  await signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, PASSWORD);
  await getDocs(collection(getFirestore(getFirebaseApp()), 'mechanics'));
}

export async function signOutClient(): Promise<void> {
  await signOut(getAuth(getFirebaseApp()));
}

/** A write as Cloud Functions / the app's trusted paths would make it (rules bypassed). */
export const write = (path: string, data: object, merge = false) =>
  restWrite(path, data as Record<string, unknown>, merge);

/** Resolves with the first emission that satisfies `until`; rejects on a listener error. */
export function nextMatching<T>(
  subscribe: (next: (v: T) => void, fail: (e: Error) => void) => () => void,
  until: (v: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = subscribe(
      (v) => {
        if (until(v)) {
          stop();
          resolve(v);
        }
      },
      (e) => reject(e),
    );
  });
}

export function requestedMinutesAgo(id: string, minutes: number): Job {
  const at = new Date(Date.now() - minutes * 60_000).toISOString();
  const base = JOBS.find((j) => j.id === 'job_req_stale')!;
  return {
    ...base,
    id,
    request: { ...base.request, id, createdAt: at },
    timeline: [{ status: 'requested', at }],
  };
}

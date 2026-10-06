import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { env } from '@/lib/env';

/** The emulator suite's project (package.json scripts). Never a real project. */
export const EMULATOR_PROJECT_ID = 'demo-autorafiki';

let app: FirebaseApp | undefined;

/**
 * Lazily initialised so nothing Firebase runs while mocks are on. Dev builds talk to the
 * emulators unless VITE_USE_EMULATORS=false; production builds always use the real project.
 */
export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (env.useEmulators) {
    app = initializeApp({ projectId: EMULATOR_PROJECT_ID, apiKey: 'demo-key' });
    connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
    connectFunctionsEmulator(getFunctions(app, env.functionsRegion), '127.0.0.1', 5001);
    return app;
  }
  if (!env.firebase.apiKey || !env.firebase.appId) {
    throw new Error('Missing VITE_FIREBASE_API_KEY / VITE_FIREBASE_APP_ID. See README → Env vars.');
  }
  app = initializeApp(env.firebase);
  return app;
}

import { readFileSync } from 'node:fs';

import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-autorafiki';

let testEnv: RulesTestEnvironment | undefined;

/** One environment per test file, against the rules file this repo deploys. */
export async function setupRulesEnv(): Promise<RulesTestEnvironment> {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST;
  if (!hostPort) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Run these tests with `npm run test:rules`.',
    );
  }
  const [host, port] = hostPort.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
      host: host!,
      port: Number(port),
    },
  });
  return testEnv;
}

export function rulesEnv(): RulesTestEnvironment {
  if (!testEnv) throw new Error('Call setupRulesEnv() in beforeAll');
  return testEnv;
}

/** An app user as Firebase Auth issues them: phone sign-in, no custom `role` claim. */
export function appUser(uid: string, phone = '+256700000000'): Firestore {
  return rulesEnv()
    .authenticatedContext(uid, { phone_number: phone, firebase: { sign_in_provider: 'phone' } })
    .firestore() as unknown as Firestore;
}

/** Dashboard staff as the dashboard signs them in: email/password with a `role` claim. */
export function staff(role: string, uid = `staff_${role}`): Firestore {
  return rulesEnv()
    .authenticatedContext(uid, {
      email: `${role}@autorafiki.test`,
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
      role,
    } as Record<string, unknown>)
    .firestore() as unknown as Firestore;
}

export function anonymous(): Firestore {
  return rulesEnv().unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Write fixture documents bypassing rules (what the Admin SDK / Cloud Functions do). */
export async function seed(docs: Record<string, object>): Promise<void> {
  await rulesEnv().withSecurityRulesDisabled(async (ctx: RulesTestContext) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

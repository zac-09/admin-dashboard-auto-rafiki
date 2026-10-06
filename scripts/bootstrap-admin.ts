/**
 * One-off: create (or promote) the FIRST dashboard admin. After this, admins manage roles in
 * the dashboard through the audited `setUserRole` callable.
 *
 * Emulator (no credentials):
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     npm run bootstrap-admin -- --project demo-autorafiki --email you@example.com --password secret123
 *
 * Production (Isaac runs this; needs Admin SDK credentials for project auto-rafiki):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     npm run bootstrap-admin -- --project auto-rafiki --email you@example.com --name "Your Name"
 *   Prints a password-setup link; the new admin opens it and chooses a password.
 *
 * Refuses when an admin already exists (pass --force to add another this way), when the
 * email belongs to an app (phone) account, and when --project is missing.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { AUDIT_COLLECTION, type AuditEntry } from '../src/types/audit';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(`bootstrap-admin: ${message}`);
  process.exit(1);
}

const projectId = values.project ?? fail('--project is required (auto-rafiki or demo-autorafiki).');
const email = values.email?.trim().toLowerCase() ?? fail('--email is required.');
const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (emulator !== Boolean(process.env.FIRESTORE_EMULATOR_HOST)) {
  fail('Set both FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST, or neither.');
}
if (!emulator && projectId.startsWith('demo-')) fail('demo-* projects only exist on the emulator.');
if (!emulator && values.password) {
  fail('--password is for the emulator only. In production the admin sets it via the link.');
}

initializeApp({ projectId });
const auth = getAuth();

async function existingAdmins(): Promise<UserRecord[]> {
  const admins: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    admins.push(...page.users.filter((u) => u.customClaims?.role === 'admin'));
    pageToken = page.pageToken;
  } while (pageToken);
  return admins;
}

async function findOrCreate(): Promise<{ user: UserRecord; created: boolean }> {
  try {
    return { user: await auth.getUserByEmail(email), created: false };
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
  const user = await auth.createUser({
    email,
    displayName: values.name,
    // Production: a throwaway the admin replaces through the password-setup link.
    password: values.password ?? randomBytes(24).toString('base64url'),
  });
  return { user, created: true };
}

const admins = await existingAdmins();
if (admins.length > 0 && !values.force) {
  fail(
    `an admin already exists (${admins.map((a) => a.email).join(', ')}). ` +
      'Use the dashboard to grant roles, or pass --force.',
  );
}

const { user, created } = await findOrCreate();
if (user.phoneNumber) {
  fail(`${email} is an app (phone) account. Staff need a separate email account.`);
}
const before = typeof user.customClaims?.role === 'string' ? user.customClaims.role : null;
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' });
await auth.revokeRefreshTokens(user.uid);

const entry: Omit<AuditEntry, 'id'> = {
  action: 'staff.bootstrap',
  actorUid: 'system',
  actorEmail: null,
  actorRole: 'system',
  targetType: 'staff',
  targetId: user.uid,
  targetLabel: email,
  before,
  after: 'admin',
  reason: created ? 'Bootstrap: first admin created' : 'Bootstrap: existing account promoted',
  at: new Date().toISOString(),
};
await getFirestore().collection(AUDIT_COLLECTION).add(entry);

console.log(
  `${created ? 'Created' : 'Promoted'} ${email} (uid ${user.uid}) as admin on ${projectId}.`,
);
if (!emulator && created) {
  console.log('Send them this password-setup link (single use, expires):');
  console.log(await auth.generatePasswordResetLink(email));
}

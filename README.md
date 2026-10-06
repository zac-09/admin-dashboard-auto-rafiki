# AutoRafiki Ops dashboard

The web dashboard the AutoRafiki operations team uses to run the marketplace. It shares the
production Firebase project `auto-rafiki` with the mobile app (repo `auto-rafiki`): same
Firestore, Auth and Cloud Functions project. Project instructions live in `claude.md`.

## Quick start (mocks, no Firebase)

```bash
nvm use            # Node 20.19+ (see .nvmrc)
npm install
npm --prefix functions install
cp .env.example .env.local   # VITE_USE_MOCKS=true by default
npm run dev
```

Sign in with `admin@autorafiki.test`, `ops@autorafiki.test` or `support@autorafiki.test`,
password `autorafiki`. `customer@autorafiki.test` shows the "no dashboard access" screen.

## Env vars (`.env.local`)

| Var                                                                                                                                      | Meaning                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_USE_MOCKS`                                                                                                                         | `true` (default): mock repositories and fixtures. `false`: real Firebase.                                                                        |
| `VITE_USE_EMULATORS`                                                                                                                     | With mocks off, dev builds use the local emulators unless `false`. Production builds never do.                                                   |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET` | Web app config from Console → Project settings → Your apps → Web app. Public by design; rules enforce access. Not needed for mocks or emulators. |
| `VITE_FUNCTIONS_REGION`                                                                                                                  | `europe-west1`.                                                                                                                                  |
| `VITE_MAPS_API_KEY`                                                                                                                      | Maps JavaScript API key for the ops map (module 2). Its own key, HTTP-referrer restricted. Not the app's keys.                                   |

## Emulator workflow

Requires the Firebase CLI and Java. Every emulator command uses the `demo-autorafiki` project,
which cannot reach production.

```bash
npm run emulators       # auth + firestore + functions (builds functions first); UI on :4000
npm run seed:emulator   # second terminal: staff accounts + contract-shaped app data
VITE_USE_MOCKS=false npm run dev
```

The seed creates the same staff accounts and password as mock mode.

## Tests

```bash
npm run typecheck       # web app, tests, scripts and functions
npm run lint
npm test                # web unit tests + functions unit tests
npm run test:rules      # Firestore rules on the emulator (fast)
npm run test:emulator   # rules + callables end to end (auth, firestore, functions emulators)
```

Tests never read `.env*` files (`envDir` is off under Vitest), so a `.env.local` pointed at
production cannot leak into a test run.

`tests/integration/operations.*.test.ts` drive the dashboard's real Firestore listeners. Under
Node the web SDK's gRPC listen stream desyncs against the emulator if a listener is its first
request, so `opsHarness.ts` signs in once per file and makes a one-off read first. Browsers use
a different transport and are unaffected.

The rules tests in `tests/rules/app.*.test.ts` drive a call-for-call port of the app's
Firestore writes (`tests/rules/appClient.ts`). They cover every app access path. A rules
change that breaks one does not ship.

## Roles and the first admin

Staff sign in with email and password. Access comes from the `role` custom claim:
`admin | ops | support` (see `src/lib/permissions.ts` for what each role may do). App users
(phone sign-in) have no `role` claim. The rules use that to keep the two groups apart:
staff read everything and write nothing directly, and staff accounts cannot use the app's
customer or mechanic paths.

**Bootstrap the first admin (one-off).** This needs Admin SDK credentials for `auto-rafiki`,
so Isaac runs it:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  npm run bootstrap-admin -- --project auto-rafiki --email you@example.com --name "Your Name"
```

It creates the account (or promotes an existing email account) and sets `role: admin`. It
writes an audit entry and prints a single-use password-setup link. It refuses to run when an
admin already exists (unless `--force`) and when the email belongs to a phone account. To try
it on the emulator, set `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST`, then use
`--project demo-autorafiki --password …`.

**After that**, admins change roles with the `setUserRole` callable (codebase `admin`). It is
admin only, needs a mandatory reason, writes to `auditLog`, and revokes the target's refresh
tokens. It refuses to change your own role and refuses phone accounts. A role change reaches
the target's dashboard at their next token refresh (at most an hour), or immediately if they
sign out and back in.

## Deploying (Isaac runs these)

Always pass `--only`. A bare `firebase deploy` would deploy rules, indexes, functions and
hosting together.

```bash
# Hosting (builds first via predeploy)
firebase deploy --only hosting --project auto-rafiki

# Dashboard Cloud Functions: codebase "admin" ONLY. Never touches the app's "default" codebase.
firebase deploy --only functions:admin --project auto-rafiki

# Firestore rules (this repo owns them; the app repo stops deploying rules after this)
firebase deploy --only firestore:rules --project auto-rafiki

# Firestore indexes: first check production has nothing missing from firebase/firestore.indexes.json
firebase firestore:indexes --project auto-rafiki
firebase deploy --only firestore:indexes --project auto-rafiki
```

One-time Console setup: enable the **Email/Password** sign-in provider (alongside Phone)
and register a **Web app** for the config values.

## Layout

```
src/types/          domain.ts + jobStateMachine.ts (verbatim from the app), firestore.ts, admin.ts, audit.ts
src/lib/            repositories (mock / firebase), session, permissions, env
src/app/            router, guards, shell (sidebar, user menu), pages
src/theme/          palettes (light default, dark option), theme mode store
functions/          Cloud Functions, codebase "admin" (bundled with esbuild; imports src/types)
firebase/           firestore.rules, firestore.indexes.json
tests/rules/        Firestore rules tests (emulator)
tests/integration/  callables end to end (emulators)
scripts/            bootstrap-admin, seed-emulator
```

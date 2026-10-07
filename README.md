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
npm run test:e2e        # real Chrome against the emulators: sign-in, live job board, alert rail
```

`test:e2e` uses your installed Google Chrome (override with `CHROME_PATH`) via puppeteer-core,
starts its own dev server on port 5199 with mocks off and emulators on, fails if the page
sends any request to a real Google API, and saves screenshots to `test-results/`.

Tests never read `.env*` files (`envDir` is off under Vitest), so a `.env.local` pointed at
production cannot leak into a test run.

`tests/integration/operations.*.test.ts` drive the dashboard's real Firestore repository. Under
Node, the web SDK's gRPC listen stream intermittently desyncs against the emulator when a
listener is open while a write lands, so those tests write first and subscribe second (see
`opsHarness.ts`). Live updates are proven in a real browser by `test:e2e` instead.

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

**After that**, admins manage staff on the **Staff** page (`/staff`): `listStaff` lists every email account with its role and last sign-in; `inviteStaff` creates an account with a role and returns a single-use password-setup link (copy it, or have Firebase email it); role changes and removal go through the `setUserRole` callable (codebase `admin`). It is
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

## Customer support

`/support` searches by phone (any Ugandan format), job id or business name, also from anywhere
with ⌘K / Ctrl+K, and lists open disputes. `/jobs/:id` is the full record: timeline, chat
transcript, ratings both ways, people, internal notes, the dispute, interventions.
`/support/people/:uid` shows a person's jobs on either side. Notes and disputes are written only
by the `addSupportNote`, `flagDispute` and `resolveDispute` callables (audited); app users can
never read them. Resolving with "Mechanic suspended" needs admin or ops.

## Revenue & analytics

`/revenue` (admin, ops). **Subscriptions**: Phase-1 UGX 15,000 per verified mechanic per week;
weeks run Monday–Sunday Kampala time, due Monday, overdue from Thursday; billed from the week a
mechanic is verified (from `TRACKING_START`, 5 Oct 2026, for mechanics verified before the
dashboard). Only payments are stored (`subscriptions/{mechanicId}_{weekStart}`, written by the
audited `markSubscriptionPaid` callable); dues are computed from the rules in
`src/lib/subscriptions.ts` and the vetting history. **KPIs**: request → arrival median (target
< 30 min), jobs/day, active mechanics (≥ 3 completed jobs in 7 days), acceptance, completion,
average rating, jobs per mechanic per week. Both tabs export CSV (formula-safe).

## Settings

`/settings` shows the prices and broadcast values the app is actually using, live: the
published `settings/app` document, or the app's built-in defaults until one is published.
Admins edit and publish them through the audited `updateSettings` callable, which validates
with exactly the app's rules (`src/lib/appSettings.ts` mirrors the app's schema). New requests
use published values within seconds; existing jobs keep their fee. App users can read
`settings/app` and nothing else under `settings/`; nobody writes it directly. A customer's own
re-broadcast may use any radius from 1 to 30 km (the settings bounds).

## Motion and loading states

Ported from the app's motion system so both feel the same (`src/components/motion`):
`presets.ts` (the app's settle / snappy / pop springs, fade timings and 55 ms list stagger),
`Reveal` (spring entrances), `Pop`, `AnimatedNumber`, and `SuccessMark` / `SuccessMoment`
(spinner → ring closes → tick draws → diamond burst → title rises) for sign-in and vetting /
suspension outcomes. Loading uses shaped skeletons with the accent sweep
(`src/components/ui/Skeleton.tsx`), never a bare "Loading…". Everything honours the OS
reduced-motion setting. Tests skip animations and choreography waits (`src/test/setup.ts`).

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

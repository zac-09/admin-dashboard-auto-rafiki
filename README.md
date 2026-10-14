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

## Vetting documents

Mechanics upload their national ID, certification and (boda only) riding permit from the app,
against a contract shared on 2026-10-08: objects at `vetting/{uid}/{docType}/{fileId}` (a fresh
file per upload, never overwritten) and a record at `mechanics/{uid}/vettingDocuments/{docType}`
with exactly six fields and no status. This repo owns both rule sets (`firebase/storage.rules`,
`firebase/firestore.rules`): the mechanic writes only under their own uid, staff read, nobody
deletes. The mechanic page renders each document inline (images, or a PDF frame) with version
and upload time, flags a missing required document, and lets admin/ops **verify or reject** it
through the audited `reviewDocument` callable. Reviews live in `vettingReviews/{uid}` (dashboard
only; the app never reads it) and name the exact file reviewed, so a re-upload shows as
"Re-uploaded since review" rather than inheriting the decision. The Decide panel shows how the
required documents stand; approving remains the operator's call. Files are fetched as blobs
under the staff member's own auth (no shareable download URLs).

### Storage CORS

Because files are downloaded inside the browser, the bucket must allow the dashboard's origins.
Firebase buckets ship with no CORS rule, and without one the document frames fail with "the
browser could not download it". The rule lives in `firebase/storage.cors.json` (GET only, from
the Hosting domains and the Vite dev server). Apply it once, as the project owner (Firebase
deploys do not carry it):

```bash
gcloud storage buckets update gs://auto-rafiki.firebasestorage.app \
  --cors-file=firebase/storage.cors.json --account=<owner account>
```

Check it with `gcloud storage buckets describe gs://auto-rafiki.firebasestorage.app
--format="default(cors_config)"`. Add an origin there if the dashboard gains a custom domain.

### Applicant pipeline

The Pending tab opens with the applicant pipeline: everyone waiting, grouped by what blocks
them (documents to review, ready for the practical assessment, waiting on the applicant),
oldest first, with days waiting, how the required documents stand, and the median days from
application to first approval over the last 90 days. Applicants who still owe a document (or
had one rejected) get call, WhatsApp and SMS nudges naming exactly what to upload. Documents
and reviews are read once per visit, one mechanic at a time (fine at pilot scale).

## App contract, 2026-10-14 (rules ready; the app builds against them)

Rules and emulator tests (`tests/rules/appContract20261014.test.ts`) for paths agreed with the
app, deployed with `firestore:rules` before the app ships them:

- `mechanics/{uid}/availability/{eventId}`: the mechanic appends `{event: 'online' | 'offline'
  | 'ping', at, location?}` (location required except when going offline). Append-only; staff
  read. Feeds online hours and coverage over time.
- `mechanics/{uid}/inbox/{messageId}`: messages from operations, written by a dashboard
  callable (Admin SDK) as `{title, body, sentAt, readAt: null}`. The mechanic reads their own
  and sets `readAt` once.
- `jobs/{jobId}/offers/{mechanicId}`: who each broadcast reached, written by the app's
  `alertMechanics` (Admin SDK). The mechanic reads their own and sets `openedAt` and
  `declinedAt` once each; customers never see offers.
- Existing paths, now pinned by tests: the mechanic writes `etaMinutes` when setting off; a
  request may carry `request.vehiclePlate`.

The dashboard screens that read these (messages composer, online hours, acceptance per
mechanic, plate search) follow once the app writes them.

## Interventions

On a job page, admin and ops can **widen the search** (same or wider radius up to 30 km, with a
fresh window from the published settings; the app's `onJobRebroadcast` trigger alerts the new
outer band, or everyone again on a renewal), **cancel** a job from requested / matched / on the
way (the app's own state machine; written as `cancelledBy: 'admin'`, which the app shows as
"Cancelled by AutoRafiki support") and **suspend** the mechanic. `cancelJob` and
`rebroadcastJob` are audited callables that also leave a note on the job. Stale requests on the
alert rail have a one-click "Widen search".

### Desktop alerts

"Desktop alerts" on the alert rail turns on browser notifications for this computer (the
choice is remembered per browser). While any dashboard tab is open, a new stale request,
late mechanic or low rating pops up even when the operator is on another page or another
app; clicking it opens the job. Each alert notifies once; several at once become one
summary; nothing pops up while the operator is looking at the control room. There is no
push service: with every dashboard tab closed, nothing arrives.

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
A payment recorded by mistake is **voided** (`voidSubscriptionPayment`, admin/ops, audited): the
record is kept with who voided it and why, the week counts as unpaid again, and a correct
payment can be recorded over it. Nothing in the audit trail is ever deleted.

### Collecting overdue payments

The Subscriptions tab opens with a "To collect" list: every mechanic carrying overdue weeks
(earlier unpaid weeks, plus this week from Thursday), most weeks first, with the amount and
the weeks. Each row has a call link and a ready-made reminder (weeks and total, no payee
details) as a WhatsApp link, an SMS link and a copy button. Recording a payment clears the
row. Suggesting suspension after N unpaid weeks waits for an agreed rule.

### Weekly pilot report

`/report` (linked from Insights, admin and ops) is one printable page for the team, partners
and investors: a week's headline numbers each compared in words with the week before, the
mechanics picture (verified, new applicants, approvals, suspensions, most jobs, who needs
attention), a six-week trend table and the five worst coverage gaps of the last four weeks.
It opens on the last full week; arrows step back through the ten weeks loaded. "Print or
save as PDF" uses the browser's print dialog; print always uses the light palette and hides
the navigation.

### Phase 2 model

Revenue → Phase 2 model replays the last 4 or 8 full weeks as if AutoRafiki had taken a
commission (5, 10, 15, 20% or any whole percent up to 30) on each completed job instead of
the weekly subscription: commission against subscriptions in total and week by week, the
break-even rate, the jobs a week a mechanic needs at the average fee to match UGX 15,000,
and who would pay more or less. Commission is on the call-out `fee` only (on-site prices are
not recorded), so the figures are a floor. A model only; it changes nothing.

## Insights

`/insights` (admin and ops) reads ten weeks of jobs, ratings, vetting history and payments
once per visit (no live listeners, no new indexes) and answers four questions:

- **Trends**: week by week (Kampala Mondays), jobs per mechanic per week, median request to
  arrival against the 30-minute target, subscriptions collected and the share of requests
  nobody took. The current week is drawn hollow (so far, not final); every chart has a
  "Show the numbers" table.
- **Coverage gaps**: requests that ended cancelled without ever being matched, grouped into
  areas of about 2 km, ranked worst first, with the distance to the nearest verified
  mechanic. The app keeps only each mechanic's latest location, so mechanic positions are
  where they are now, not where they were at the time.
- **Demand by hour**: requests and unanswered requests by weekday and hour, plus the three
  hours that most need more mechanics online.
- **Mechanic scorecards**: a ranked table (also a Performance panel on each mechanic's page)
  with jobs per week, request-to-arrival, lateness, cancellations, the 30-day rating and its
  trend, subscription arrears, and signals (top performer, often late, cancels often, rating
  falling or low, payment overdue; thresholds in `src/features/insights/scorecard.ts`).
  Lateness compares travel time (set off to arrival) with the app's own estimate for the
  `distanceKm` driven (18 km/h), because the app does not store the ETA it shows. Acceptance
  per mechanic is not measurable: the app does not record who saw a broadcast.

In mock mode the dev server adds ten weeks of deterministic history
(`src/lib/mocks/historyFixtures.ts`) so these views have something to show; tests opt in.

## Settings

`/settings` shows the prices and broadcast values the app is actually using, live: the
published `settings/app` document, or the app's built-in defaults until one is published.
Admins edit and publish them through the audited `updateSettings` callable, which validates
with exactly the app's rules (`src/lib/appSettings.ts` mirrors the app's schema). New requests
use published values within seconds; existing jobs keep their fee. App users can read
`settings/app` and nothing else under `settings/`; nobody writes it directly. A customer's own
re-broadcast may use any radius from 1 to 30 km (the settings bounds).

Since 2026-10-08 the document also carries **support contacts** (the emergency line every app
job screen offers to call, and the support email; the app's compiled number is a placeholder the
dashboard warns about until it is replaced) and the **request catalogue** (the parts and jobs
customers tap; ids are stored on jobs, so the editor adds and relabels items but can never remove
a published one, and `updateSettings` refuses a publish that would). Job cards and job pages show
a request's catalogue items as labels, falling back to the raw id for an unknown one.

## Audit log

`/audit` (admin and ops) lists every audited decision in one place: vetting, document
reviews, interventions, disputes, payments and voids, settings and staff changes. Filter by
action, by staff member and by free text (subject, job id, reason, before/after values) over
the last 7, 30 or 90 days or all time; filters live in the URL, so a filtered view can be
shared. Each entry links to its subject. The query orders `auditLog` by `at` only, which
Firestore's automatic single-field index covers.

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

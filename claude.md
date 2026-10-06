# AutoRafiki Admin Dashboard — Project Instructions

## What this is

The web dashboard the AutoRafiki operations team uses to run the marketplace:
vet mechanics who apply to join, watch jobs live on a map, support customers,
track Phase-1 subscription revenue, and administer the platform. It shares the
production Firebase project with the mobile app (repo `auto-rafiki`): same
Firestore, same Auth instance, same Cloud Functions project. It is a separate
codebase, deployed to Firebase Hosting.

Desktop-first (ops staff on laptops), responsive enough to triage from a phone.

## Firebase project facts

- Project id: `auto-rafiki`. Firestore region `africa-south1`. Cloud Functions
  region `europe-west1` (2nd gen). Blaze plan is on.
- Production deploys (`firebase deploy …`) are run by Isaac, not by the agent.
  Prepare the change, verify it on the emulator, and hand Isaac the exact command.
- The Firebase CLI is logged in as Isaac's personal account, which owns the
  project. Other Google accounts on this machine have no access to it.

## Deploy boundaries (getting these wrong deletes production code)

- **Cloud Functions**: this repo deploys codebase **`admin`** (set `"codebase": "admin"`
  in firebase.json). The app repo owns codebase **`default`**, which contains
  `onJobCreated`, `onJobStatusChanged`, `onMessageCreated`, `onRatingCreated` and
  `expireStaleRequests`. Never deploy into `default`; a functions deploy removes
  any function in its codebase that isn't in the source being deployed.
- **Firestore rules and indexes are owned by this repo.** The app repo stops
  deploying them once this repo's first rules deploy ships. Starting point: copy the
  app's `firebase/firestore.rules` and `firebase/firestore.indexes.json` verbatim
  into this repo, get the emulator tests green against them, then extend.
  Never drop an existing index; the app's queries depend on them.
- Firebase Hosting for this dashboard is the only Hosting target in the project.

## Stack (decided)

- **React + TypeScript (strict) + Vite**; React Router
- **Tailwind CSS** themed to the AutoRafiki design system (tokens below)
- **Firebase JS SDK**: Auth, Firestore (onSnapshot for everything live),
  Storage (vetting documents, once the app uploads them), **Cloud Functions**
  for privileged mutations
- **@tanstack/react-query** for non-realtime reads; Firestore listeners for
  live boards; **zustand** for UI state
- **Google Maps JavaScript API** for the live ops map
- eslint + prettier + vitest + @testing-library/react
- Firestore emulator + `@firebase/rules-unit-testing` for rules tests
- Mock-first behind `VITE_USE_MOCKS=true`, mirroring the app repo's pattern:
  repository interfaces, fixtures shaped exactly like the data contract below,
  no Firebase needed to run the UI

## Design system (same identity as the app)

```ts
export const colors = {
  background: "#101215",
  surface: "#17191C",
  hairline: "#333C47",
  textPrimary: "#F4F6F8",
  textMuted: "#B7C0C9",
  accent: "#19C2D8",
  onAccent: "#101215",
  accentText: "#0B6875", // the only accent allowed as text on light surfaces
  success: "#34C08B",
  danger: "#FF7B72",
  warning: "#DFAD4C",
};
```

Dark theme throughout (the app defaults to light with a dark option; the ops
tool stays dark). Sharp radii (3 for controls, 6 for panels); hairline-bordered
panels over filled cards; letterspaced sentence-case micro-labels; the diamond
(45°-rotated square) as bullet/step motif; one accent moment per region.
Sidebar navigation with the wheel monogram (smiling steering wheel) in an
accent ring at the top. Dense data tables are fine, since this is an ops tool,
but keep row height ≥ 40px and all text ≥ 12px at ≥ 4.5:1 contrast. Never
convey state by colour alone. Money is UGX, formatted `UGX 35,000`.

## Data contract with the mobile app (read before touching data)

The app repo is the source of truth for the shared data model; its types live
in `src/types/domain.ts` there. Mirror them in this repo. Never invent fields
the app doesn't write and never rename existing ones; if the dashboard needs
something new, see "Cross-repo requests" below.

All dates are ISO-8601 strings, except `presence.lastSeen`, which is a Firestore
server Timestamp. Phone numbers are E.164 Ugandan (`+2567…`).

### Collections

- `users/{uid}` (private to the user): `phone`, `displayName`, `roles[]`
  (`'customer' | 'mechanic'`, a user can hold both), `activeRole`, `createdAt`,
  `fcmToken` (customer pushes).
- `profiles/{uid}` (public): `displayName`; `ratingAverage` / `ratingCount` for
  the customer side (written by Cloud Functions only).
- `mechanics/{uid}`: `userId`, `businessName`, `phone`, `services[]`,
  `vehicles[]` (`car | boda | truck | matatu`), `ratingAverage`, `ratingCount`,
  `jobsCompleted`, **`vetting: 'pending' | 'verified' | 'suspended'`**,
  `isOnline` (available for jobs), `lastKnownLocation {latitude, longitude, label}`
  (updated about every 5 s / 15 m while online), `calloutFee`, `fcmToken`.
  The app creates the doc with `vetting: 'pending'` and its rules forbid the
  mechanic from ever changing `vetting`. Only `verified` + `isOnline` mechanics
  receive job broadcasts.
- `jobs/{jobId}`: `request {customerId, location {latitude, longitude, label},
vehicle, service, description, createdAt}`, `status`, `radiusKm` (5, widened
  once to 8), `expiresAt`, `mechanicId`, `fee` (UGX, fixed when requested),
  `etaMinutes?`, `distanceKm?` (km actually driven, written on arrival),
  `timeline [{status, at}]`, `cancelledBy` (`'customer' | 'mechanic' | 'system'`).
  Services: `flat-tyre | battery | engine | fuel | lockout | towing | other`.
- `jobs/{jobId}/messages/{id}`: `jobId`, `senderId`, `senderRole`, `text`,
  `createdAt`. Immutable after the id write.
- `ratings/{id}`: `jobId`, `mechanicId`, `customerId`, `ratedBy`
  (`'customer' | 'mechanic'`; absent means customer), `stars` 1–5, `comment?`,
  `createdAt`.
- `presence/{uid}`: `online`, `lastSeen` (server Timestamp), `viewingJobId`.
  This is "app open right now", not availability; an `online` older than 75 s
  is stale.

### Job state machine

`requested → matched → enroute → arrived → working → complete`, with
`cancelled` reachable from `requested`, `matched` and `enroute`. Matching is
broadcast, first-accept-wins, via a Firestore transaction in the app.
Customers may cancel until `working`; a mechanic can never accept their own
request. Every intervention Cloud Function in this repo must respect the same
transitions (port the app's `assertTransition` and its tests) and append to
`timeline` exactly as the app does.

### Cross-repo requests (the app doesn't have these yet; don't fake them)

Raise each with Isaac as an app-repo change before building on it:

- **Vetting documents**: the app does not use Firebase Storage and mechanics
  cannot upload ID, certification or riding permit yet. Agree the Storage path
  layout and an application/documents schema first.
- **Per-document verification statuses**: today the only verification field is
  `mechanics.vetting`, and the app's profile screen renders only that.
- **A `settings` doc** for prices, broadcast radius and timeout. The app
  currently compiles these in: flat-tyre 30,000, battery 35,000, engine 50,000,
  fuel 25,000, lockout 30,000, towing 80,000, other 30,000 UGX; radius 5 km,
  then 8 km; 90 s broadcast windows.
- **An admin `cancelledBy` value** (for example `'admin'`), because the app renders it.
- **Vehicle plate number** and **corridor** are not captured on requests.
- Jobs carry no geohash; mechanic lookup is client-side filtering at pilot scale.

## Authorization model (build this first; nothing ships without it)

- Admins sign in with **email + password** (Firebase Auth), never phone OTP.
  Enable the email/password provider alongside the app's phone provider.
- Roles via **custom claims**: `role: 'admin' | 'ops' | 'support'`. App users
  have no `role` claim; rules tell the two populations apart by its presence.
- A `setUserRole` callable Cloud Function (callable only by `admin`) sets
  claims; a one-off bootstrap script using the Admin SDK creates the first
  admin. Document both in the README.
- **Firestore security rules are part of this deliverable**: app users keep
  exactly the access they have today (see the data contract); dashboard roles
  read everything; sensitive mutations (approve/suspend mechanic, cancel or
  re-broadcast a job, mark subscription paid, change settings) are **Cloud
  Functions only**, and the rules must reject direct client writes to those
  fields.
- Rules ship with emulator unit tests covering **every app access path** (own
  user doc, public profiles, mechanic self-edit without touching `vetting`,
  job create/accept/advance/cancel, chat, ratings in both directions, presence)
  plus the new dashboard paths. A rules change that breaks an app path does
  not ship.

## Modules, in build order

### 1. Mechanic vetting (the trust product)

- Queue views over `mechanics` by `vetting`: Pending / Verified / Suspended.
  Detail page shows the profile (business name, phone, services, vehicles,
  rating, jobs completed, last-known location) and the practical-assessment
  checklist.
- Approve / reject / suspend with a mandatory reason, via a Cloud Function that
  sets `mechanics/{uid}.vetting`. A rejection is recorded in the audit log and
  keeps the mechanic `pending` or `suspended`; agree the exact rejected state
  with the app first.
- Documents (national ID, mechanic certification, riding permit) render inline
  once the cross-repo document upload exists; until then the detail page shows
  a "no documents uploaded" state, never mock documents in production.
- Every decision writes an audit entry (who, when, what, reason). Immutable:
  rules allow create by Cloud Functions only, never update or delete.
- Re-verification: surface mechanics verified more than 12 months ago (from the
  audit log).

### 2. Live operations (the control room)

- Realtime job board: columns by status (requested → matched → enroute →
  arrived → working → complete / cancelled), Firestore listeners, newest
  first, each card showing service, vehicle, location label, fee and elapsed
  time in the current state (from `timeline`).
- Live map (port the app's `src/lib/maps/darkStyle.ts` to Maps JS): job pins by
  status, online mechanics' `lastKnownLocation`, click-through to the job
  detail. Listen only to non-terminal jobs and online mechanics to keep reads down.
- Alert rail: jobs `requested` for more than 2 min with no acceptance, `enroute`
  for more than 30 min (the north-star metric breached), any rating of 2 or
  fewer stars. These are the operator's to-do list.
- Interventions (Cloud Functions): cancel a job with a reason, re-broadcast with a
  wider radius, suspend a mechanic. Every intervention is audited.

### 3. Customer support

- Universal search: phone number, job id, mechanic business name (plate search
  waits for the cross-repo plate field).
- Job timeline view: every status change with timestamps, the chat transcript,
  ratings in both directions, distance driven, and support annotations
  (`supportNotes` subcollection, internal only, never readable by app users).
- Actions: add a note, flag a dispute, resolve a dispute with an outcome (v1 has
  no refunds because payments are direct, so outcomes are notes plus mechanic
  sanctions), one-click `tel:` links to call either party.

### 4. Revenue & analytics (the business model lives here)

- **Phase-1 subscription tracker** (dashboard-owned collection): active
  mechanics with weekly UGX 15,000 status (paid / due / overdue), and a manual
  "mark paid" (Cloud Function, audited), since v1 has no payment rails. Weekly
  totals. This is the company's only revenue instrument until Phase 2; treat
  it as such.
- KPI cards wired to the business plan: median request-to-arrival (target
  < 30 min, from `timeline`), jobs/day, active mechanics (≥ 3 jobs/week),
  acceptance rate, completion rate, average rating, jobs per mechanic per
  week (the pilot's make-or-break number).
- CSV export of jobs and subscriptions for the team's reporting.

### 5. Settings & admin

- Upfront price table per service, broadcast radius and timeout: built against
  the cross-repo `settings` doc; until the app reads it, show the current
  compiled values read-only and say so in the UI.
- Admin user management (list, invite, role change; admin role only).

## Maps key (do not reuse the app's keys)

The dashboard needs **Maps JavaScript API** enabled and its own API key
restricted by HTTP referrer (the Hosting domain and localhost) and to the
JavaScript API. The app's Android Maps key is restricted to the app's package
and SHA-1, and its Routes key is API-restricted; neither is usable here by design. JS
map loads meter against the free tier; an internal ops tool sits far inside
it, but don't embed this map anywhere public.

## Out of scope

- Payment gateway integration and automated commission (Phase 2)
- Mechanic- or customer-facing features (those live in the app)
- Multi-tenant / white-label anything

## Working agreements

- Commit per task; keep `typecheck`, `lint`, `test` green at every commit.
- Anything that changes shared data (new fields, new collections the app reads,
  rules affecting app paths) is coordinated with the app repo first.
- Never point a dev build at production with write-capable test scripts; use
  the emulator. Production data changes go through audited Cloud Functions.

## Definition of done

- Role-gated login; a `support` user cannot approve mechanics or change roles
- Vetting flow works end to end on the emulator against real-shaped
  `mechanics` docs, the audit trail is written, and documents render once the
  cross-repo upload exists
- Job board and map update live from emulator writes; the alert rail fires on a
  stale `requested` job
- Subscription tracker computes weekly dues and records audited payments
- Firestore rules tested in the emulator: every app access path unchanged,
  client writes to protected fields rejected
- Functions deploy under codebase `admin` without touching `default`
- `typecheck`, `lint`, `test` green; README covers the bootstrap-admin script,
  env vars, emulator workflow, and deploy to Firebase Hosting

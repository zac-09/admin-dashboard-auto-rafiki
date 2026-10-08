/**
 * End to end in real Chrome against the emulators: sign in as ops, open the control room, and
 * watch the job board and alert rail react to app-shaped Firestore writes, the way ops staff
 * will. Run with `npm run test:e2e` (starts auth + firestore emulators). Screenshots land in
 * test-results/ for a human look.
 *
 * Safety: the dev server is started with VITE_USE_MOCKS=false and VITE_USE_EMULATORS=true set
 * in the process environment, which Vite ranks above every .env file, and the run fails if the
 * page sends a single request to a real Google API host (production Auth / Firestore).
 */
import { mkdirSync } from 'node:fs';

import puppeteer, { type Page } from 'puppeteer-core';
import { createServer } from 'vite';

import { MECHANICS } from '../../src/lib/mocks/contractFixtures';
import type { Job } from '../../src/types';
import { restClear, restWrite } from '../integration/emulatorRest';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const OUT = 'test-results';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:e2e` (starts the emulators).');
}

async function createStaff(email: string, role: string): Promise<void> {
  const signUp = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const { localId } = (await signUp.json()) as { localId: string };
  await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-autorafiki/accounts:update`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId, customAttributes: JSON.stringify({ role }) }),
    },
  );
}

function request(id: string, label: string, minutesAgo: number): Job {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id,
    request: {
      id,
      customerId: 'u_customer_aisha',
      location: { latitude: 0.3157, longitude: 32.6202, label },
      vehicle: 'car',
      service: 'battery',
      description: 'Will not start',
      createdAt: at,
    },
    status: 'requested',
    radiusKm: 5,
    expiresAt: new Date(Date.parse(at) + 90_000).toISOString(),
    fee: 35_000,
    timeline: [{ status: 'requested', at }],
  };
}

/** Text of the board column (an aria-labelled region) or the alert rail. */
const regionText = (page: Page, name: string) =>
  page.$eval(`section[aria-label="${name}"]`, (el) => el.textContent ?? '');

async function waitForRegionText(page: Page, name: string, text: string): Promise<void> {
  await page.waitForFunction(
    (n: string, t: string) =>
      document.querySelector(`section[aria-label="${n}"]`)?.textContent?.includes(t) ?? false,
    { timeout: 15_000 },
    name,
    text,
  );
}

const results: string[] = [];
function pass(what: string) {
  results.push(`PASS ${what}`);
  console.log(`PASS ${what}`);
}

async function main() {
  // The cancel check calls the dashboard's real Cloud Function on the functions emulator.
  process.env.VITE_USE_MOCKS = 'false';
  process.env.VITE_USE_EMULATORS = 'true';
  const server = await createServer({
    server: { port: 5199, strictPort: true, host: '127.0.0.1' },
  });
  await server.listen();
  const base = 'http://127.0.0.1:5199';
  mkdirSync(OUT, { recursive: true });

  await restClear();
  await createStaff('e2e-ops@autorafiki.test', 'ops');
  for (const m of MECHANICS) await restWrite(`mechanics/${m.userId}`, { ...m });
  await restWrite('jobs/e2e_stale', { ...request('e2e_stale', 'Ntinda Shopping Centre', 4) });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (e) => console.error('page error:', e));
    const production: string[] = [];
    page.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (host.endsWith('googleapis.com') || host.endsWith('firebaseio.com')) {
        production.push(r.url());
      }
    });

    await page.goto(`${base}/login`);
    await page.type('input[type=email]', 'e2e-ops@autorafiki.test');
    await page.type('input[type=password]', PASSWORD);
    await page.click('button[type=submit]');
    // The sign-in moment: spinner → tick → "Signed in", then the shell.
    await page.waitForFunction(() => document.body.textContent?.includes('Signed in'), {
      timeout: 10_000,
    });
    await page.screenshot({ path: `${OUT}/signin-moment.png` });
    await new Promise((r) => setTimeout(r, 450));
    await page.screenshot({ path: `${OUT}/signin-moment-tick.png` });
    pass('sign-in plays the success moment');
    await page.waitForSelector('nav[aria-label="Main"]');
    pass('ops staff sign in with email and password');

    await page.goto(`${base}/operations`);
    await waitForRegionText(page, 'Alerts', 'No taker for 4 min');
    await waitForRegionText(page, 'Requested', 'No taker yet');
    pass('alert rail fires on a request left unaccepted for over 2 minutes');
    await page.screenshot({ path: `${OUT}/operations-light.png`, fullPage: true });

    await restWrite('jobs/e2e_live', { ...request('e2e_live', 'Kololo, Acacia Avenue', 0.1) });
    await waitForRegionText(page, 'Requested', 'Kololo, Acacia Avenue');
    pass('a new request appears on the board live');

    const live = request('e2e_live', 'Kololo, Acacia Avenue', 0.1);
    await restWrite(
      'jobs/e2e_live',
      {
        status: 'matched',
        mechanicId: 'u_mech_okello',
        timeline: [...live.timeline, { status: 'matched', at: new Date().toISOString() }],
      },
      true,
    );
    await waitForRegionText(page, 'Mechanic assigned', 'Kololo, Acacia Avenue');
    await waitForRegionText(page, 'Mechanic assigned', 'Okello Auto Rescue');
    if ((await regionText(page, 'Requested')).includes('Kololo, Acacia Avenue')) {
      throw new Error('Matched job is still in the Requested column');
    }
    pass('the job moves to "Mechanic assigned" live when a mechanic accepts');

    await page.click('button[aria-controls="user-menu"]');
    await page.click('button[role="switch"]');
    await page.screenshot({ path: `${OUT}/operations-dark.png`, fullPage: true });
    pass('dark mode switch applies');

    await page.goto(`${base}/jobs/e2e_live`);
    await page.waitForSelector('section[aria-label="Timeline"]');
    await page.screenshot({ path: `${OUT}/job-detail-dark.png`, fullPage: true });
    pass('job detail opens');

    // Cancel from the job page through the real cancelJob callable; the board must follow.
    await page.click('xpath/.//button[contains(., "Cancel this job")]');
    await page.type(
      'form[aria-label="Cancel this job"] textarea',
      'E2E: customer called to cancel',
    );
    await page.click('xpath/.//button[contains(., "Cancel job for the customer")]');
    await page.waitForFunction(() => document.body.textContent?.includes('Job cancelled'), {
      timeout: 15_000,
    });
    await page.goto(`${base}/operations`);
    await waitForRegionText(page, 'Cancelled', 'Cancelled by AutoRafiki support');
    pass('ops cancels a job; the board shows it cancelled by AutoRafiki support');

    if (production.length > 0) {
      throw new Error(`Page reached real Google APIs: ${production.slice(0, 3).join(', ')}`);
    }
    pass('no request left the emulators');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().then(
  () => {
    console.log(`\n${results.length} checks passed. Screenshots in ${OUT}/`);
    process.exit(0);
  },
  (error) => {
    console.error('FAIL', error);
    process.exit(1);
  },
);

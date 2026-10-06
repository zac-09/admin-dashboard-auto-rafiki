/**
 * Firestore emulator writes over REST (plain HTTP, rules bypassed with the emulator's "owner"
 * token): seed data for tests that drive the dashboard's own web-SDK client, without starting
 * another Firestore client in the process.
 */
const PROJECT = 'demo-autorafiki';

function base(): string {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set');
  return `http://${host}`;
}

type Value =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: Value[] } }
  | { mapValue: { fields: Record<string, Value> } };

function toValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
}

function toFields(obj: Record<string, unknown>): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, toValue(v)]),
  );
}

async function call(method: string, url: string, body?: unknown): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`);
}

/** Create or replace a document, or (merge) update only the given top-level fields. */
export async function restWrite(path: string, data: Record<string, unknown>, merge = false) {
  const mask = merge
    ? '?' +
      Object.keys(data)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&')
    : '';
  await call(
    'PATCH',
    `${base()}/v1/projects/${PROJECT}/databases/(default)/documents/${path}${mask}`,
    { fields: toFields(data) },
  );
}

export async function restClear() {
  await call('DELETE', `${base()}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
}

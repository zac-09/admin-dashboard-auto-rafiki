import type { AdminSession, AuthRepository, Unsubscribe } from '@/types';

import { MOCK_APP_USER, MOCK_PASSWORD, MOCK_STAFF } from './fixtures';

const STORAGE_KEY = 'autorafiki.mockSession';

function readStored(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

function writeStored(session: AdminSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the session simply won't survive a reload.
  }
}

/** In-memory auth over MOCK_STAFF; the session survives reloads within the tab. */
export class MockAuthRepository implements AuthRepository {
  private session: AdminSession | null = readStored();
  private listeners = new Set<(session: AdminSession | null) => void>();

  async signIn(email: string, password: string): Promise<AdminSession> {
    const normalized = email.trim().toLowerCase();
    const account = [...MOCK_STAFF, MOCK_APP_USER].find((s) => s.email === normalized);
    if (!account || password !== MOCK_PASSWORD) {
      throw Object.assign(new Error('Wrong email or password.'), {
        code: 'auth/invalid-credential',
      });
    }
    this.set(account);
    return account;
  }

  async signOut(): Promise<void> {
    this.set(null);
  }

  subscribe(onChange: (session: AdminSession | null) => void): Unsubscribe {
    this.listeners.add(onChange);
    onChange(this.session);
    return () => this.listeners.delete(onChange);
  }

  private set(session: AdminSession | null): void {
    this.session = session;
    writeStored(session);
    this.listeners.forEach((l) => l(session));
  }
}

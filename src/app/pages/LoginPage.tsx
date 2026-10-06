import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Button, Notice, TextField, WheelMark } from '@/components/ui';
import { env } from '@/lib/env';
import { MOCK_PASSWORD } from '@/lib/mocks/fixtures';
import { getRepositories } from '@/lib/repositories';
import { setSession, useSessionStore } from '@/lib/session';

export function LoginPage() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signedIn') return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      setSession(await getRepositories().auth.signIn(email, password));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setError(null);
    if (!email.trim()) return setError('Enter your email first, then choose "Reset password".');
    try {
      await getRepositories().auth.sendPasswordReset(email);
      setInfo(`If ${email.trim()} has a staff account, a reset link is on its way.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="panel flex w-full max-w-sm flex-col gap-5 p-6"
        noValidate
      >
        <div className="flex items-center gap-3">
          <WheelMark size={44} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-[0.2em]">AUTORAFIKI</span>
            <span className="micro-label">Operations dashboard</span>
          </div>
        </div>
        <h1 className="text-lg font-semibold">Staff sign-in</h1>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        {info ? <Notice tone="info">{info}</Notice> : null}
        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <button type="button" onClick={onReset} className="self-start text-sm underline">
          Reset password
        </button>
        {import.meta.env.DEV && env.useMocks ? (
          <p className="text-xs text-muted">
            Mock mode: admin@, ops@ or support@autorafiki.test, password “{MOCK_PASSWORD}”.
          </p>
        ) : null}
      </form>
    </main>
  );
}

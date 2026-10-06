import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Reveal, SuccessMoment } from '@/components/motion';
import { Button, Notice, TextField, WheelMark } from '@/components/ui';
import { env } from '@/lib/env';
import { MOCK_PASSWORD } from '@/lib/mocks/fixtures';
import { getRepositories } from '@/lib/repositories';
import { setSession, useSessionStore } from '@/lib/session';
import type { AdminSession } from '@/types';

type Moment = { status: 'pending' } | { status: 'success'; session: AdminSession };

export function LoginPage() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);

  // Hold the redirect while the sign-in moment plays (the auth listener signs us in first).
  if (status === 'signedIn' && !moment) return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setMoment({ status: 'pending' });
    try {
      const session = await getRepositories().auth.signIn(email, password);
      if (!session.role) {
        // No dashboard role: no celebration, straight to the explanation.
        setMoment(null);
        setSession(session);
        return;
      }
      setMoment({ status: 'success', session });
    } catch (e) {
      setMoment(null);
      setError((e as Error).message);
    }
  }

  function onMomentDone() {
    if (moment?.status === 'success') setSession(moment.session);
    setMoment(null);
  }

  const busy = moment !== null;

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
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Checking your account…"
          title="Signed in"
          subtitle={
            moment.status === 'success'
              ? `Welcome back, ${moment.session.displayName ?? moment.session.email}`
              : undefined
          }
          holdMs={900}
          onDone={onMomentDone}
        />
      ) : null}
      <Reveal className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="panel flex w-full flex-col gap-5 p-6" noValidate>
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
            Sign in
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
      </Reveal>
    </main>
  );
}

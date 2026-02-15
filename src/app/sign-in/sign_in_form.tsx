'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '../_components/toast_provider';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();

  const resolveSession = async () => {
    const response = await fetch('/api/auth/session');
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as { user?: { id?: string } };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password.');
      setIsSubmitting(false);
      return;
    }

    const session = await resolveSession();
    if (!session?.user?.id) {
      setError('Unable to sign in. Please try again.');
      setIsSubmitting(false);
      return;
    }

    const next = searchParams.get('next') ?? '/';
    router.push(next);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm text-slate-300">
        Work email
        <input
          className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
          placeholder="you@studio.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="block text-sm text-slate-300">
        Password
        <input
          className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
          placeholder="••••••••"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <button
        className="w-full rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>
      <button
        className="w-full rounded-xl border border-slate-700/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 disabled:opacity-60"
        disabled={!email}
        onClick={async () => {
          const result = await signIn('resend', {
            email,
            redirect: false,
          });
          if (result?.error) {
            setError('Unable to send magic link.');
            pushToast({
              title: 'Magic link failed',
              description: 'Check Resend configuration.',
              tone: 'error',
            });
            return;
          }
          pushToast({
            title: 'Magic link sent',
            description: 'Check your email to continue.',
            tone: 'success',
          });
        }}
        type="button"
      >
        Send Magic Link
      </button>
      <button
        className="w-full rounded-xl border border-slate-700/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 opacity-60"
        disabled
        type="button"
      >
        Continue with Google (Coming Soon)
      </button>
      <p className="text-xs text-slate-500">
        Magic link + OAuth providers will be enabled after the auth workflow is
        finalized.
      </p>
    </form>
  );
}

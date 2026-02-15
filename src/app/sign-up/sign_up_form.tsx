'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '../_components/toast_provider';

export function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
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

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? 'Unable to sign up.');
      setIsSubmitting(false);
      return;
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Account created. Please sign in.');
      setIsSubmitting(false);
      return;
    }

    const session = await resolveSession();
    if (!session?.user?.id) {
      setError('Account created. Please sign in.');
      setIsSubmitting(false);
      return;
    }

    pushToast({
      title: 'Welcome to Houseworks',
      description: 'Your account is ready.',
      tone: 'success',
    });
    router.push('/');
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm text-slate-300">
        Full name
        <input
          className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
          placeholder="Alex Rivera"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
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
        Password (min 8 chars)
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
        {isSubmitting ? 'Creating…' : 'Create Account'}
      </button>
    </form>
  );
}

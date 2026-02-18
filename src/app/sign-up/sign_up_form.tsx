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
      <label className="block text-sm text-foreground">
        Full name
        <input
          className="mt-2 w-full rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Alex Rivera"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-sm text-foreground">
        Work email
        <input
          className="mt-2 w-full rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="you@studio.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="block text-sm text-foreground">
        Password (min 8 chars)
        <input
          className="mt-2 w-full rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="••••••••"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

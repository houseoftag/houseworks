'use client';

import { useState, type FormEvent } from 'react';
import { trpc } from '@/trpc/react';
import { useRouter } from 'next/navigation';

type InviteFormProps = {
  token: string;
};

export function InviteForm({ token }: InviteFormProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const acceptInvite = trpc.invites.accept.useMutation({
    onError: () => {
      setError('Invite link is invalid or expired.');
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => router.push('/sign-in'), 1500);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    acceptInvite.mutate({ token, name, password });
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
        Password
        <input
          className="mt-2 w-full rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Minimum 8 characters"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {success ? (
        <p className="text-xs text-emerald-600">Invite accepted! Redirecting…</p>
      ) : null}
      <button
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={acceptInvite.isPending || !name || password.length < 8}
        type="submit"
      >
        {acceptInvite.isPending ? 'Joining…' : 'Join workspace'}
      </button>
    </form>
  );
}

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
        Password
        <input
          className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
          placeholder="Minimum 8 characters"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      {success ? (
        <p className="text-xs text-emerald-400">Invite accepted! Redirecting…</p>
      ) : null}
      <button
        className="w-full rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
        disabled={acceptInvite.isPending || !name || password.length < 8}
        type="submit"
      >
        {acceptInvite.isPending ? 'Joining…' : 'Join Workspace'}
      </button>
    </form>
  );
}

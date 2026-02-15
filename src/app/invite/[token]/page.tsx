import Link from 'next/link';
import { InviteForm } from './invite_form';

type InvitePageProps = {
  params: { token: string };
};

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Houseworks · Invite
          </p>
          <h1 className="text-3xl font-semibold text-slate-100">
            You&apos;re invited
          </h1>
          <p className="text-sm text-slate-400">
            Set up your credentials to join this workspace. If you already have
            an account, sign in instead.
          </p>
          <div className="text-xs text-slate-500">
            <Link className="text-slate-200 underline" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 lg:w-5/12">
          <InviteForm token={params.token} />
        </div>
      </div>
    </div>
  );
}

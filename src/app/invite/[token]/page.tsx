import Link from 'next/link';
import { InviteForm } from './invite_form';

type InvitePageProps = {
  params: { token: string };
};

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-4xl flex-col gap-8 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Houseworks · Invite
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            You&apos;re invited
          </h1>
          <p className="text-sm text-slate-500">
            Set up your credentials to join this workspace. If you already have
            an account, sign in instead.
          </p>
          <div className="text-xs text-slate-400">
            <Link className="text-primary underline" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:w-5/12">
          <InviteForm token={params.token} />
        </div>
      </div>
    </div>
  );
}

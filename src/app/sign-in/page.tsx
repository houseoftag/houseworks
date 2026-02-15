import Link from 'next/link';
import { SignInForm } from './sign_in_form';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Houseworks · Auth
          </p>
          <h1 className="text-3xl font-semibold text-slate-100">
            Welcome back
          </h1>
          <p className="text-sm text-slate-400">
            Sign in to manage your workspace, track post-production items, and
            kick off automations. Magic links and OAuth providers are queued
            up next.
          </p>
          <div className="text-xs text-slate-500">
            <span>Need an invite?</span>{' '}
            <Link className="text-slate-200 underline" href="/">
              Return to the workspace
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 lg:w-5/12">
          <SignInForm />
          <p className="mt-4 text-xs text-slate-500">
            Dev login: admin@houseworks.local · password123
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Need an account?{' '}
            <Link className="text-slate-200 underline" href="/sign-up">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

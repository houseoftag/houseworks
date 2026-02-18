import Link from 'next/link';
import { SignInForm } from './sign_in_form';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Houseworks · Auth
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500">
            Sign in to manage your workspace, track post-production items, and
            kick off automations. Magic links and OAuth providers are queued
            up next.
          </p>
          <div className="text-xs text-slate-400">
            <span>Need an invite?</span>{' '}
            <Link className="text-primary underline" href="/sign-up">
              Request access
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:w-5/12">
          <SignInForm />
          <p className="mt-4 text-xs text-slate-400">
            Need an account?{' '}
            <Link className="text-primary underline" href="/sign-up">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

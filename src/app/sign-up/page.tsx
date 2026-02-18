import Link from 'next/link';
import { SignUpForm } from './sign_up_form';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Houseworks · Sign Up
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-slate-500">
            Set up your workspace and invite your team. You can always switch to
            magic link login later.
          </p>
          <div className="text-xs text-slate-400">
            <span>Already have an account?</span>{' '}
            <Link className="text-primary underline" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:w-5/12">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

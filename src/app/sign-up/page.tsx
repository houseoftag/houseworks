import Link from 'next/link';
import { SignUpForm } from './sign_up_form';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16 lg:flex-row lg:items-center">
        <div className="space-y-4 lg:w-1/2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Houseworks · Sign Up
          </p>
          <h1 className="text-3xl font-semibold text-slate-100">
            Create your account
          </h1>
          <p className="text-sm text-slate-400">
            Set up your workspace and invite your team. You can always switch to
            magic link login later.
          </p>
          <div className="text-xs text-slate-500">
            <span>Already have an account?</span>{' '}
            <Link className="text-slate-200 underline" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 lg:w-5/12">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

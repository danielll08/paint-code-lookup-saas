"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { formatVrm, parseVehicleIdentifier } from "@/lib/vrm";
import { Alert, Button, Spinner } from "@/components/ui";
import {
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
  type AuthFormState,
} from "./actions";

const inputClass =
  "mt-1 block h-11 w-full rounded-lg border-0 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Spinner />}
      {children}
    </Button>
  );
}

function useNextParam() {
  const params = useSearchParams();
  const vrm = parseVehicleIdentifier(params.get("vrm") ?? "")?.value ?? null;
  const next = params.get("next") ?? (vrm ? `/dashboard?vrm=${vrm}` : "/dashboard");
  return { next, vrm, error: params.get("error") };
}

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <GoogleSubmit />
    </form>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <Spinner />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.56 10.56 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      or with email
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function VrmNotice({ vrm }: { vrm: string | null }) {
  if (!vrm) return null;
  return (
    <Alert className="mb-6">
      Create a free account to see the paint code for <strong className="plate">{formatVrm(vrm)}</strong>.
    </Alert>
  );
}

export function LoginForm() {
  const { next, vrm, error: linkError } = useNextParam();
  const [state, action] = useActionState<AuthFormState, FormData>(signInWithPassword, {});

  return (
    <>
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}${vrm ? `&vrm=${vrm}` : ""}`} className="font-semibold text-brand-600">
          Create an account
        </Link>
      </p>
      <VrmNotice vrm={vrm} />
      {linkError && !state.error && <Alert tone="error" className="mb-4">{linkError}</Alert>}
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          <span className="flex justify-between">
            Password
            <Link href="/forgot-password" className="font-semibold text-brand-600">
              Forgot password?
            </Link>
          </span>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton>Log in</SubmitButton>
      </form>
    </>
  );
}

export function SignupForm() {
  const { next, vrm } = useNextParam();
  const [state, action] = useActionState<AuthFormState, FormData>(signUpWithPassword, {});

  if (state.message) {
    return (
      <>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <Alert tone="success" className="mt-6">
          {state.message}
        </Alert>
        <p className="mt-6 text-sm text-slate-600">
          Already confirmed?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-600">
            Log in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Already have one?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}${vrm ? `&vrm=${vrm}` : ""}`} className="font-semibold text-brand-600">
          Log in
        </Link>
      </p>
      <VrmNotice vrm={vrm} />
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">
          Name <span className="font-normal text-slate-400">(optional)</span>
          <input name="full_name" type="text" autoComplete="name" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </label>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton>Create account</SubmitButton>
        <p className="text-center text-xs text-slate-500">We&apos;ll email you a link to verify your address.</p>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">We&apos;ll email you a secure link to choose a new password.</p>
      <form action={action} className="space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
        </label>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-600">
          Back to log in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Confirm password
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </label>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton>Update password</SubmitButton>
      </form>
    </>
  );
}

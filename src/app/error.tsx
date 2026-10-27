"use client";

import { Button, ButtonLink } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const misconfigured = error.message.includes("Missing required environment variable");
  const staleSession = error.message.includes("Profile not found");
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-16 text-center">
      <div className="w-full max-w-md border border-ink-950/20 border-t-2 border-t-brand-600 bg-white p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
            <path d="M10.3 3.6 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] text-ink-950">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {staleSession
            ? "This local demo was restarted, so the saved session no longer matches the database. Sign out and log in again."
            : misconfigured
              ? "The server is not fully configured yet (see .env.example)."
              : "Please try again. If a credit was taken for a failed lookup it is refunded automatically."}
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-ink-400">Ref: {error.digest}</p>}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {staleSession ? (
            <form action="/auth/signout" method="post">
              <Button type="submit" className="w-full sm:w-auto">
                Sign out &amp; reset
              </Button>
            </form>
          ) : (
            <Button onClick={reset}>Try again</Button>
          )}
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

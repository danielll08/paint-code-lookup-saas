import { ButtonLink } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { AccountMenu } from "./account-menu";
import { CreditBadge } from "./credit-badge";

export async function HeaderAccount() {
  const profile = await getProfile();
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <CreditBadge userId={profile.id} initialBalance={profile.credit_balance} />
      <ButtonLink href="/dashboard/billing" size="sm" className="whitespace-nowrap">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M10 4v12M4 10h12" strokeLinecap="round" />
        </svg>
        <span>
          Buy<span className="max-sm:hidden"> Credits</span>
        </span>
      </ButtonLink>
      <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-ink-950/15 sm:block" />
      <AccountMenu email={profile.email} name={profile.full_name} />
    </div>
  );
}

export function HeaderAccountSkeleton() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden>
      <span className="h-8 w-36 animate-pulse rounded-[2px] bg-ink-200" />
      <span className="h-9 w-24 animate-pulse rounded-[2px] bg-ink-200" />
      <span className="h-9 w-9 animate-pulse rounded-[2px] bg-ink-200" />
    </div>
  );
}

/** PRD 5.3: failed renewal banner. Top-up credits remain usable. */
export async function AccountAlerts() {
  const profile = await getProfile();
  if (profile.subscription_status !== "past_due") return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
      <span className="mr-1.5 inline-flex align-middle text-amber-600" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M12 2 1 21h22L12 2Zm0 5.4L18.9 19H5.1L12 7.4ZM11 10h2v5h-2v-5Zm0 7h2v2h-2v-2Z" />
        </svg>
      </span>
      Your last subscription payment failed. Please{" "}
      <form action="/api/stripe/portal" method="post" className="inline">
        <button type="submit" className="font-semibold underline underline-offset-2">
          update your card
        </button>
      </form>{" "}
      to keep receiving monthly credits. Any top-up credits you have can still be used.
    </div>
  );
}

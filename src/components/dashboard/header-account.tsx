import { ButtonLink } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { AccountMenu } from "./account-menu";
import { CreditBadge } from "./credit-badge";

export async function HeaderAccount() {
  const profile = await getProfile();
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <CreditBadge userId={profile.id} initialBalance={profile.credit_balance} />
      <ButtonLink href="/dashboard/billing" size="sm" className="whitespace-nowrap">
        <span>
          + Buy<span className="hidden sm:inline"> Credits</span>
        </span>
      </ButtonLink>
      <AccountMenu email={profile.email} name={profile.full_name} />
    </div>
  );
}

export function HeaderAccountSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-8 w-36 animate-pulse rounded-full bg-slate-200" />
      <span className="h-8 w-28 animate-pulse rounded-lg bg-slate-200" />
      <span className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
    </div>
  );
}

/** PRD 5.3: failed renewal banner. Top-up credits remain usable. */
export async function AccountAlerts() {
  const profile = await getProfile();
  if (profile.subscription_status !== "past_due") return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
      Your last subscription payment failed. Please{" "}
      <form action="/api/stripe/portal" method="post" className="inline">
        <button type="submit" className="font-semibold underline">
          update your card
        </button>
      </form>{" "}
      to keep receiving monthly credits. Any top-up credits you have can still be used.
    </div>
  );
}

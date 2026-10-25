import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOrigin } from "@/lib/origin";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { getStripe } from "@/lib/stripe/server";

// "Manage Subscription / Invoices" -> Stripe-hosted Customer Portal (PRD 3.2.3).
export async function POST() {
  const origin = await getOrigin();
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/dashboard/billing`, 303);

  try {
    const customer = await ensureStripeCustomer(user);
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard/billing`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("[api/stripe/portal]", error);
    return NextResponse.redirect(`${origin}/dashboard/billing?error=portal_failed`, 303);
  }
}

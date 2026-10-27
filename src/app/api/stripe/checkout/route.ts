import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOrigin } from "@/lib/origin";
import { getPlan, getTopUpPack } from "@/lib/plans";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { getStripe, planLineItem, topUpLineItem } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Plain <form method="post"> target, so it works without client JS.
// Credits are NOT granted here or on the success page - only by the webhook (PRD 3.3.B).
export async function POST(request: NextRequest) {
  const origin = await getOrigin();
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/dashboard/billing`, 303);

  const form = await request.formData();
  const kind = form.get("kind");
  const itemId = String(form.get("item") ?? "");

  try {
    const stripe = getStripe();
    const customer = await ensureStripeCustomer(user);
    const metadata = { user_id: user.id, kind: String(kind), item_id: itemId };

    if (kind === "subscription") {
      const plan = getPlan(itemId);
      if (!plan) return NextResponse.redirect(`${origin}/dashboard/billing?error=unknown_plan`, 303);

      // Already subscribed: plan changes and cancellation happen in the Customer Portal.
      const { data: profile } = await createAdminClient()
        .from("users")
        .select("subscription_status")
        .eq("id", user.id)
        .single();
      if (profile && ["active", "trialing", "past_due"].includes(profile.subscription_status)) {
        const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/dashboard/billing` });
        return NextResponse.redirect(portal.url, 303);
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [planLineItem(plan)],
        metadata,
        subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/billing?canceled=1`,
        allow_promotion_codes: true,
      });
      return NextResponse.redirect(session.url!, 303);
    }

    if (kind === "topup") {
      const pack = getTopUpPack(itemId);
      if (!pack) return NextResponse.redirect(`${origin}/dashboard/billing?error=unknown_pack`, 303);

      // With auto top-up on, keep the card so later top-ups can be charged off-session.
      const { data: profile } = await createAdminClient().from("users").select("auto_topup_pack").eq("id", user.id).single();
      const saveCard = Boolean(profile?.auto_topup_pack);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer,
        client_reference_id: user.id,
        line_items: [topUpLineItem(pack)],
        metadata,
        payment_intent_data: { metadata, ...(saveCard && { setup_future_usage: "off_session" as const }) },
        invoice_creation: { enabled: true },
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/billing?canceled=1`,
      });
      return NextResponse.redirect(session.url!, 303);
    }

    return NextResponse.redirect(`${origin}/dashboard/billing?error=invalid_request`, 303);
  } catch (error) {
    console.error("[api/stripe/checkout]", error);
    return NextResponse.redirect(`${origin}/dashboard/billing?error=checkout_failed`, 303);
  }
}

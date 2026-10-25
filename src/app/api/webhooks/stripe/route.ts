import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripeWebhookSecret } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";
import { handleStripeEvent } from "@/lib/stripe/webhook";

// The ONLY place credits are added after a payment (PRD 3.3.B).
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  // The signature is computed over the exact raw body.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, stripeWebhookSecret());
  } catch (error) {
    console.warn("[stripe webhook] signature verification failed:", (error as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    // Duplicate deliveries are no-ops: stripe_event_id is UNIQUE in credit_transactions.
    await handleStripeEvent(event);
  } catch (error) {
    console.error(`[stripe webhook] ${event.type} ${event.id} failed:`, error);
    // Non-2xx makes Stripe retry later; handlers are idempotent.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

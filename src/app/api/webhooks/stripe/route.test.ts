import { NextRequest } from "next/server";
import Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const handled = vi.hoisted(() => ({ events: [] as string[], fail: false }));

vi.mock("@/lib/stripe/webhook", () => ({
  handleStripeEvent: async (event: { id: string }) => {
    if (handled.fail) throw new Error("db down");
    handled.events.push(event.id);
  },
}));

const SECRET = "whsec_test_secret";
let POST: (request: NextRequest) => Promise<Response>;
const stripe = new Stripe("sk_test_dummy");

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  handled.events = [];
  handled.fail = false;
});

function request(payload: string, signature?: string) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

const payload = JSON.stringify({ id: "evt_test_1", object: "event", type: "invoice.paid", data: { object: {} } });

describe("POST /api/webhooks/stripe", () => {
  it("rejects requests without a signature", async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(400);
    expect(handled.events).toEqual([]);
  });

  it("rejects a forged signature", async () => {
    const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    const response = await POST(request(payload, forged));
    expect(response.status).toBe(400);
    expect(handled.events).toEqual([]);
  });

  it("rejects a tampered body", async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const response = await POST(request(payload.replace("evt_test_1", "evt_test_2"), signature));
    expect(response.status).toBe(400);
  });

  it("accepts a correctly signed event", async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const response = await POST(request(payload, signature));
    expect(response.status).toBe(200);
    expect(handled.events).toEqual(["evt_test_1"]);
  });

  it("returns 500 so Stripe retries when processing fails", async () => {
    handled.fail = true;
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const response = await POST(request(payload, signature));
    expect(response.status).toBe(500);
  });
});

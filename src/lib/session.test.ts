import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("Direct Google OAuth Session Tokens", () => {
  it("creates and verifies a valid session payload", async () => {
    const user = {
      id: "google_test_user_123",
      email: "danieldangg12112008@gmail.com",
      name: "Daniel Dang",
    };

    const token = await createSessionToken(user, 3600);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(user.id);
    expect(verified?.email).toBe(user.email);
    expect(verified?.name).toBe(user.name);
  });

  it("rejects a tampered session token", async () => {
    const user = {
      id: "google_test_user_123",
      email: "danieldangg12112008@gmail.com",
    };
    const token = await createSessionToken(user, 3600);
    const tampered = token.slice(0, -5) + "abcde";

    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects an expired session token", async () => {
    const user = {
      id: "google_expired",
      email: "expired@test.com",
    };
    // TTL of -10 seconds (already expired)
    const token = await createSessionToken(user, -10);
    const verified = await verifySessionToken(token);
    expect(verified).toBeNull();
  });
});

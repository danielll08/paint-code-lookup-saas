import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { performLookup } from "@/lib/lookup/service";
import type { LookupApiResponse } from "@/lib/lookup/types";

const bodySchema = z.object({ vrm: z.string().min(1).max(40) });

function json(body: LookupApiResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return json({ status: "unauthorized", message: "Please sign in to look up paint codes." }, 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ status: "invalid", message: "Enter a registration number." }, 400);

  try {
    const { httpStatus, body } = await performLookup(user.id, parsed.data.vrm);
    return json(body, httpStatus);
  } catch (error) {
    console.error("[api/lookup]", error);
    return NextResponse.json(
      { status: "provider_error", charged: false, message: "Something went wrong. If a credit was taken it will be refunded automatically." },
      { status: 500 },
    );
  }
}

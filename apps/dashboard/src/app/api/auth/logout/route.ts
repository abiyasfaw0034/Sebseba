import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { authenticateRequest, revokeAllSessions, revokeOtherSessions, revokeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Scope = "current" | "others" | "all";

export const OPTIONS = () => corsPreflight(methods);

// Revokes sessions server-side so the token can't be reused after sign-out.
// scope: "current" (this device, default), "others" (every other device), "all" (everywhere).
export const POST = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const body = await request.json().catch(() => null);
  const requested = isRecord(body) && typeof body.scope === "string" ? body.scope : "current";
  const scope: Scope = requested === "others" || requested === "all" ? requested : "current";

  let revoked = 0;
  if (scope === "all") {
    revoked = await revokeAllSessions(auth.email);
  } else if (scope === "others") {
    revoked = await revokeOtherSessions(auth.email, auth.sid);
  } else {
    revoked = (await revokeSession(auth.email, auth.sid)) ? 1 : 0;
  }

  return withCors(NextResponse.json({ ok: true, scope, revoked }), methods);
};

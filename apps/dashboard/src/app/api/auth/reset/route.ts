import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, getClientIp, withCors } from "@/lib/http";
import { isValidPassword, resetPassword } from "@/lib/auth";
import { hitRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";
const resetLimit = { limit: 10, windowMs: 15 * 60 * 1000 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const OPTIONS = () => corsPreflight(methods);

// Consumes a reset token and sets a new password. On success every session is revoked.
export const POST = async (request: NextRequest) => {
  const ip = getClientIp(request);
  const check = hitRateLimit(`reset-confirm:${ip}`, resetLimit);

  if (!check.allowed) {
    const response = withCors(
      NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 }),
      methods,
    );
    response.headers.set("Retry-After", String(check.retryAfterSeconds));
    return response;
  }

  const body = await request.json().catch(() => null);

  if (!isRecord(body)) {
    return withCors(NextResponse.json({ error: "Expected a JSON object body." }, { status: 400 }), methods);
  }

  const token = body.token;
  const password = body.password;

  if (!isValidPassword(password)) {
    return withCors(
      NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 }),
      methods,
    );
  }

  const ok = await resetPassword(token, password);

  if (!ok) {
    return withCors(
      NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 }),
      methods,
    );
  }

  return withCors(
    NextResponse.json({ ok: true, message: "Password updated. Please sign in with your new password." }),
    methods,
  );
};

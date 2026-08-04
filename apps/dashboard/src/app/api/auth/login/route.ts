import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, getClientIp, withCors } from "@/lib/http";
import { findAccountByEmail, normalizeEmail, signToken, startSession, verifyPassword } from "@/lib/auth";
import { clearRateLimit, hitRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";

// Per email+IP: slow down guessing at one account. Per IP: blunt spraying across many accounts.
const perAccountLimit = { limit: 8, windowMs: 15 * 60 * 1000 };
const perIpLimit = { limit: 40, windowMs: 15 * 60 * 1000 };

const invalidCredentials = () =>
  withCors(NextResponse.json({ error: "Invalid email or password." }, { status: 401 }), methods);

export const OPTIONS = () => corsPreflight(methods);

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null) {
    return withCors(NextResponse.json({ error: "Expected a JSON object body." }, { status: 400 }), methods);
  }

  const email = normalizeEmail((body as Record<string, unknown>).email);
  const password = (body as Record<string, unknown>).password;
  const ip = getClientIp(request);

  const ipCheck = hitRateLimit(`login-ip:${ip}`, perIpLimit);
  const accountCheck = email ? hitRateLimit(`login:${email}:${ip}`, perAccountLimit) : ipCheck;

  if (!ipCheck.allowed || !accountCheck.allowed) {
    const retryAfterSeconds = Math.max(ipCheck.retryAfterSeconds, accountCheck.retryAfterSeconds);
    const response = withCors(
      NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429 },
      ),
      methods,
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }

  if (!email || typeof password !== "string") {
    return invalidCredentials();
  }

  const account = await findAccountByEmail(email);

  // Verify against the stored hash when present; the generic response avoids leaking whether the email exists.
  if (!account || !verifyPassword(password, account.salt, account.passHash)) {
    return invalidCredentials();
  }

  // Successful login — don't keep penalising this user for earlier failures.
  clearRateLimit(`login:${email}:${ip}`);

  const label = request.headers.get("user-agent") ?? "Unknown device";
  const sid = await startSession(account.email, label);
  const token = signToken(account, sid);
  return withCors(NextResponse.json({ token, memberId: account.id, email: account.email }), methods);
};

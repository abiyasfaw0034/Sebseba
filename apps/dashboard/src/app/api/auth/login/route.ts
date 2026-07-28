import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { findAccountByEmail, normalizeEmail, signToken, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";
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

  if (!email || typeof password !== "string") {
    return invalidCredentials();
  }

  const account = await findAccountByEmail(email);

  // Verify against the stored hash when present; the generic response avoids leaking whether the email exists.
  if (!account || !verifyPassword(password, account.salt, account.passHash)) {
    return invalidCredentials();
  }

  const token = signToken(account);
  return withCors(NextResponse.json({ token, memberId: account.id, email: account.email }), methods);
};

import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { createAccount, isValidEmail, isValidPassword, normalizeEmail, signToken, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";

export const OPTIONS = () => corsPreflight(methods);

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null) {
    return withCors(NextResponse.json({ error: "Expected a JSON object body." }, { status: 400 }), methods);
  }

  const email = normalizeEmail((body as Record<string, unknown>).email);
  const password = (body as Record<string, unknown>).password;

  if (!isValidEmail(email)) {
    return withCors(NextResponse.json({ error: "Enter a valid email address." }, { status: 400 }), methods);
  }

  if (!isValidPassword(password)) {
    return withCors(
      NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 }),
      methods,
    );
  }

  try {
    const account = await createAccount(email, password);
    const label = request.headers.get("user-agent") ?? "Unknown device";
    const sid = await startSession(account.email, label);
    const token = signToken(account, sid);

    return withCors(
      NextResponse.json({ token, memberId: account.id, email: account.email }, { status: 201 }),
      methods,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "account-exists") {
      return withCors(
        NextResponse.json({ error: "An account with this email already exists." }, { status: 409 }),
        methods,
      );
    }

    console.error("Registration failed", error);
    return withCors(NextResponse.json({ error: "Could not create the account." }, { status: 500 }), methods);
  }
};

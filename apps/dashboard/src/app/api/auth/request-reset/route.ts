import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, getClientIp, withCors } from "@/lib/http";
import { createResetToken, normalizeEmail } from "@/lib/auth";
import { hitRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "POST, OPTIONS";
const resetLimit = { limit: 5, windowMs: 15 * 60 * 1000 };

// Always returned, whether or not the email exists, to avoid confirming which addresses are registered.
const genericMessage = "If an account exists for that email, a password reset link has been created.";

export const OPTIONS = () => corsPreflight(methods);

export const POST = async (request: NextRequest) => {
  const ip = getClientIp(request);
  const check = hitRateLimit(`reset:${ip}`, resetLimit);

  if (!check.allowed) {
    const response = withCors(
      NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 }),
      methods,
    );
    response.headers.set("Retry-After", String(check.retryAfterSeconds));
    return response;
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).email : undefined,
  );

  const issued = email ? await createResetToken(email) : null;

  // No email provider is wired up in the prototype, so in development we return the token
  // directly to make the flow testable. In production this MUST be delivered by email instead.
  const includeToken = process.env.NODE_ENV !== "production" && issued;

  return withCors(
    NextResponse.json({
      ok: true,
      message: genericMessage,
      ...(includeToken
        ? { devResetToken: issued.token, expiresInMinutes: issued.expiresInMinutes }
        : {}),
    }),
    methods,
  );
};

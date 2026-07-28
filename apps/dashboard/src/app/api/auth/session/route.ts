import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { getBearerToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, OPTIONS";

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  const payload = verifyToken(getBearerToken(request));

  if (!payload) {
    return withCors(NextResponse.json({ error: "Invalid or expired session." }, { status: 401 }), methods);
  }

  return withCors(NextResponse.json({ memberId: payload.sub, email: payload.email }), methods);
};

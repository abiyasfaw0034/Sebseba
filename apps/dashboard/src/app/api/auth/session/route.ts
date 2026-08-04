import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, OPTIONS";

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Invalid or expired session." }, { status: 401 }), methods);
  }

  return withCors(NextResponse.json({ memberId: auth.memberId, email: auth.email }), methods);
};

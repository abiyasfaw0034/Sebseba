import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { authenticateRequest, listSessions, revokeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, DELETE, OPTIONS";

export const OPTIONS = () => corsPreflight(methods);

// Lists this account's active sessions, flagging the one making the request.
export const GET = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const sessions = (await listSessions(auth.email)).map((session) => ({
    sid: session.sid,
    label: session.label,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    current: session.sid === auth.sid,
  }));

  return withCors(NextResponse.json({ sessions }), methods);
};

// Revokes a specific session by id: DELETE /api/auth/sessions?sid=...
export const DELETE = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const sid = request.nextUrl.searchParams.get("sid")?.trim();

  if (!sid) {
    return withCors(NextResponse.json({ error: "A sid query parameter is required." }, { status: 400 }), methods);
  }

  const revoked = await revokeSession(auth.email, sid);

  if (!revoked) {
    return withCors(NextResponse.json({ error: "Session not found." }, { status: 404 }), methods);
  }

  return withCors(NextResponse.json({ ok: true, revoked: sid }), methods);
};

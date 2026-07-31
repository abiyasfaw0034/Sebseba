import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { getAuthenticatedMemberId } from "@/lib/auth";
import { getInbox, markThreadRead } from "@/lib/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, POST, OPTIONS";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  const memberId = getAuthenticatedMemberId(request);

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const conversations = await getInbox(memberId);
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  return withCors(NextResponse.json({ conversations, unreadTotal }), methods);
};

// Marks the thread with a peer as read (clears this member's unread count for that peer).
export const POST = async (request: NextRequest) => {
  const memberId = getAuthenticatedMemberId(request);

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const body = await request.json().catch(() => null);
  const peerId = isRecord(body) && typeof body.peerId === "string" ? body.peerId.trim() : "";

  if (!peerId) {
    return withCors(NextResponse.json({ error: "A peerId is required." }, { status: 400 }), methods);
  }

  const cleared = await markThreadRead(memberId, peerId);
  return withCors(NextResponse.json({ ok: true, cleared }), methods);
};

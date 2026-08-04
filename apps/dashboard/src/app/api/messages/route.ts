import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { authenticateRequest } from "@/lib/auth";
import { getThread, sendMessage } from "@/lib/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, POST, OPTIONS";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  const memberId = (await authenticateRequest(request))?.memberId ?? null;

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const peerId = request.nextUrl.searchParams.get("peerId")?.trim();

  if (!peerId) {
    return withCors(NextResponse.json({ error: "A peerId query parameter is required." }, { status: 400 }), methods);
  }

  if (peerId === memberId) {
    return withCors(NextResponse.json({ messages: [] }), methods);
  }

  const messages = await getThread(memberId, peerId);
  return withCors(NextResponse.json({ messages }), methods);
};

export const POST = async (request: NextRequest) => {
  const memberId = (await authenticateRequest(request))?.memberId ?? null;

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const body = await request.json().catch(() => null);

  if (!isRecord(body)) {
    return withCors(NextResponse.json({ error: "Expected a JSON object body." }, { status: 400 }), methods);
  }

  const toMemberId = typeof body.toMemberId === "string" ? body.toMemberId.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";

  if (!toMemberId || toMemberId === memberId) {
    return withCors(NextResponse.json({ error: "A valid recipient is required." }, { status: 400 }), methods);
  }

  if (!text.trim()) {
    return withCors(NextResponse.json({ error: "Message text is required." }, { status: 400 }), methods);
  }

  try {
    const message = await sendMessage({ senderId: memberId, recipientId: toMemberId, text });
    return withCors(NextResponse.json({ message }, { status: 201 }), methods);
  } catch {
    return withCors(NextResponse.json({ error: "Could not send message." }, { status: 400 }), methods);
  }
};

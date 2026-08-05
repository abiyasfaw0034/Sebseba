import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { authenticateRequest } from "@/lib/auth";
import { bookEvent, cancelBooking, listUpcomingEvents } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, POST, OPTIONS";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const OPTIONS = () => corsPreflight(methods);

// Upcoming hosted rooms, flagging the ones the caller has already booked.
export const GET = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const events = await listUpcomingEvents(auth.memberId);
  return withCors(NextResponse.json({ events }), methods);
};

// Book or cancel a seat: { eventId, action: "book" | "cancel" }.
export const POST = async (request: NextRequest) => {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const body = await request.json().catch(() => null);
  const eventId = isRecord(body) && typeof body.eventId === "string" ? body.eventId.trim() : "";
  const action = isRecord(body) && body.action === "cancel" ? "cancel" : "book";

  if (!eventId) {
    return withCors(NextResponse.json({ error: "An eventId is required." }, { status: 400 }), methods);
  }

  const result =
    action === "cancel"
      ? await cancelBooking(eventId, auth.memberId)
      : await bookEvent(eventId, auth.memberId);

  if (!result.ok) {
    const status = result.reason === "not-found" ? 404 : 409;
    const message =
      result.reason === "full"
        ? "This room is fully booked."
        : result.reason === "past"
          ? "This room has already started."
          : "Hosted room not found.";
    return withCors(NextResponse.json({ error: message, reason: result.reason }, { status }), methods);
  }

  return withCors(NextResponse.json({ ok: true, event: result.listing }), methods);
};

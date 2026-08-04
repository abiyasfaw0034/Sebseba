import { NextResponse } from "next/server";

/** Adds permissive CORS headers so the Expo mobile client can call these routes from any origin. */
export const withCors = (response: NextResponse, methods = "GET, POST, PUT, OPTIONS"): NextResponse => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const corsPreflight = (methods?: string): NextResponse =>
  withCors(new NextResponse(null, { status: 204 }), methods);

/** Best-effort client IP from proxy headers, used to key rate limits. Falls back to "unknown". */
export const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
};

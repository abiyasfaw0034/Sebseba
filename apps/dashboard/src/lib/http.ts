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

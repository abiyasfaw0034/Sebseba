import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { getMemberExportRows } from "@/lib/dashboard";
import { getEventExportRows } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, OPTIONS";

// Optional ops gate: if ABIYASFAW_OPS_TOKEN is set, the export requires it (header or ?key=).
// When unset (local dev), the export is open so the console stays easy to work with.
const opsToken = process.env.ABIYASFAW_OPS_TOKEN?.trim();

const escapeCsv = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
};

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  if (opsToken) {
    const provided = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-ops-key");
    if (provided !== opsToken) {
      return withCors(NextResponse.json({ error: "Not authorized." }, { status: 401 }), methods);
    }
  }

  const dataset = request.nextUrl.searchParams.get("dataset") ?? "members";

  if (dataset !== "members" && dataset !== "events") {
    return withCors(
      NextResponse.json({ error: "dataset must be 'members' or 'events'." }, { status: 400 }),
      methods,
    );
  }

  const rows = dataset === "events" ? await getEventExportRows() : await getMemberExportRows();
  const csv = toCsv(rows as unknown as Record<string, unknown>[]);

  const response = new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abiyasfaw-${dataset}.csv"`,
    },
  });
  return withCors(response, methods);
};

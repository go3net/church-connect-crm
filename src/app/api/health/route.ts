import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health — liveness + DB connectivity (for Railway healthcheck / uptime monitors)
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    { ok: dbOk, db: dbOk ? "up" : "down", ts: new Date().toISOString() },
    { status: dbOk ? 200 : 503 }
  );
}

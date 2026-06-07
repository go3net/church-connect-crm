import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { advanceDueEnrollments } from "@/lib/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cron/automation-advance — advances all due automation enrollments
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const result = await advanceDueEnrollments({ limit: 500 });
    return NextResponse.json({ ok: true, ...result });
  });
}

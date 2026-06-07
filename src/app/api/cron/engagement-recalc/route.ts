import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { db } from "@/lib/db";
import { recomputeEngagement } from "@/lib/engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/engagement-recalc — recompute engagement scores per church
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const churches = await db.church.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    let total = 0;
    for (const c of churches) {
      total += await recomputeEngagement(c.id);
    }
    return NextResponse.json({ ok: true, churches: churches.length, membersScored: total });
  });
}

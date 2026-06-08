import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { dispatchQueuedMessages } from "@/lib/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/cron/broadcast-dispatch — drain the outbound message queue
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const result = await dispatchQueuedMessages(500);
    return NextResponse.json({ ok: true, ...result });
  });
}

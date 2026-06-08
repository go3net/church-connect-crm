import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireCtx, handle } from "@/lib/tenant";
import { sendBroadcast } from "@/lib/broadcast";
import { dispatchQueuedMessages } from "@/lib/messaging";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
  segment: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().optional(),
  templateId: z.string().optional(),
});

// GET /api/broadcasts — recent outbound activity summary
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const recent = await db.communicationLog.groupBy({
      by: ["status"],
      where: { churchId: ctx.churchId, direction: "OUTBOUND" },
      _count: true,
    });
    const totals = Object.fromEntries(recent.map((r) => [r.status, r._count]));
    const last = await db.communicationLog.findMany({
      where: { churchId: ctx.churchId, direction: "OUTBOUND" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, channel: true, toAddress: true, status: true, body: true, createdAt: true },
    });
    return NextResponse.json({ totals, last });
  });
}

// POST /api/broadcasts — send to a segment
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("broadcast:send");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;
    const result = await sendBroadcast({
      churchId: ctx.churchId,
      senderId: ctx.userId,
      channel: d.channel,
      segment: d.segment,
      body: d.body,
      subject: d.subject,
      templateId: d.templateId,
    });
    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "BROADCAST",
      entity: "CommunicationLog",
      description: `Broadcast ${d.channel} to ${d.segment} (${result.recipients} recipients)`,
    });

    // drain a first batch now for instant feedback on small sends; the
    // broadcast-dispatch cron handles any overflow.
    await dispatchQueuedMessages(100).catch(() => {});

    return NextResponse.json({ ok: true, ...result });
  });
}

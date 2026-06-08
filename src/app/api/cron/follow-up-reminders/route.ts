import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { db } from "@/lib/db";
import { dispatchMessage } from "@/lib/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cron/follow-up-reminders — WhatsApp each assignee a digest of due/overdue follow-ups
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const now = new Date();

    // group due/overdue PENDING follow-ups by assignee
    const grouped = await db.followUp.groupBy({
      by: ["assignedToId", "churchId"],
      where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lte: now } },
      _count: true,
    });

    let notified = 0;
    for (const g of grouped) {
      const user = await db.user.findFirst({
        where: { id: g.assignedToId, isActive: true, deletedAt: null, phone: { not: null } },
        select: { name: true, phone: true },
      });
      if (!user?.phone) continue;
      const church = await db.church.findUnique({ where: { id: g.churchId } });
      const [first, ...rest] = (user.name ?? "Leader").split(" ");

      await dispatchMessage({
        churchId: g.churchId,
        channel: "WHATSAPP",
        person: { firstName: first, lastName: rest.join(" "), phone: user.phone },
        body: `Hi ${first}, you have ${g._count} follow-up(s) due. Please check your Church Connect dashboard and reach out to them this week. God bless you.`,
        waPhoneId: church?.waPhoneId,
        smsSenderId: church?.senderId,
      }).catch(() => {});
      notified++;
    }

    return NextResponse.json({ ok: true, assigneesNotified: notified });
  });
}

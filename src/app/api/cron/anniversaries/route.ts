import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { db } from "@/lib/db";
import { dispatchMessage } from "@/lib/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cron/anniversaries — wedding-anniversary greetings for today's couples
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    const members = await db.$queryRaw<
      { id: string; churchId: string; branchId: string | null; firstName: string; lastName: string; phone: string; email: string | null }[]
    >`
      SELECT id, "churchId", "branchId", "firstName", "lastName", phone, email
      FROM "Member"
      WHERE "deletedAt" IS NULL
        AND "weddingDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "weddingDate") = ${month}
        AND EXTRACT(DAY FROM "weddingDate") = ${day}
    `;

    let sent = 0;
    for (const m of members) {
      const tpl = await db.messageTemplate.findFirst({
        where: { churchId: m.churchId, category: "anniversary", isActive: true },
      });
      const church = await db.church.findUnique({ where: { id: m.churchId } });
      const body =
        tpl?.body ??
        "Congratulations on your wedding anniversary {{firstName}}. May God continue to strengthen your home with love, peace, and joy.";

      for (const channel of ["WHATSAPP", "SMS"] as const) {
        await dispatchMessage({
          churchId: m.churchId,
          branchId: m.branchId,
          channel,
          person: { memberId: m.id, firstName: m.firstName, lastName: m.lastName, phone: m.phone, email: m.email },
          body,
          templateId: tpl?.id ?? null,
          waPhoneId: church?.waPhoneId,
          smsSenderId: church?.senderId,
        }).catch(() => {});
      }
      sent++;
    }

    return NextResponse.json({ ok: true, couples: members.length, sent });
  });
}

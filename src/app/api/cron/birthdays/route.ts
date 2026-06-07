import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { db } from "@/lib/db";
import { dispatchMessage } from "@/lib/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cron/birthdays — send birthday greetings (WhatsApp + SMS) to today's celebrants
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    // Postgres month/day match (raw for portability across tz)
    const members = await db.$queryRaw<
      { id: string; churchId: string; branchId: string | null; firstName: string; lastName: string; phone: string; email: string | null }[]
    >`
      SELECT id, "churchId", "branchId", "firstName", "lastName", phone, email
      FROM "Member"
      WHERE "deletedAt" IS NULL
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
        AND EXTRACT(DAY FROM "dateOfBirth") = ${day}
    `;

    let sent = 0;
    for (const m of members) {
      const tpl = await db.messageTemplate.findFirst({
        where: { churchId: m.churchId, category: "birthday", isActive: true },
      });
      const church = await db.church.findUnique({ where: { id: m.churchId } });
      const body =
        tpl?.body ??
        "Happy Birthday {{firstName}}. We celebrate you today and pray that God grants you greater grace, favour, and blessings.";

      for (const channel of ["WHATSAPP", "SMS"] as const) {
        await dispatchMessage({
          churchId: m.churchId,
          branchId: m.branchId,
          channel,
          person: {
            memberId: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            phone: m.phone,
            email: m.email,
          },
          body,
          templateId: tpl?.id ?? null,
          waPhoneId: church?.waPhoneId,
          smsSenderId: church?.senderId,
        }).catch(() => {});
      }
      sent++;
    }

    return NextResponse.json({ ok: true, celebrants: members.length, sent });
  });
}

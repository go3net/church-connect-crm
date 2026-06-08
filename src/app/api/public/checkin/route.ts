import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle } from "@/lib/tenant";
import { normalizePhone } from "@/lib/phone";
import { markAttendance } from "@/lib/attendance";

const schema = z.object({
  serviceId: z.string().min(1),
  phone: z.string().min(7),
});

// POST /api/public/checkin — self check-in by phone (no auth; church derived from service)
export async function POST(req: NextRequest) {
  return handle(async () => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Phone and service required" }, { status: 422 });
    }
    const phone = normalizePhone(parsed.data.phone);
    const service = await db.service.findUnique({
      where: { id: parsed.data.serviceId },
      select: { id: true, churchId: true, name: true },
    });
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const member = await db.member.findUnique({
      where: { churchId_phone: { churchId: service.churchId, phone } },
      select: { id: true, firstName: true },
    });
    const firstTimer = member
      ? null
      : await db.firstTimer.findUnique({
          where: { churchId_phone: { churchId: service.churchId, phone } },
          select: { id: true, firstName: true },
        });

    if (!member && !firstTimer) {
      return NextResponse.json(
        { error: "We couldn't find that number. Please see an usher to register." },
        { status: 404 }
      );
    }

    const result = await markAttendance({
      churchId: service.churchId,
      serviceId: service.id,
      memberId: member?.id ?? null,
      firstTimerId: firstTimer?.id ?? null,
      method: "SELF_CHECKIN",
    });

    const name = (member ?? firstTimer)!.firstName;
    return NextResponse.json({
      ok: true,
      name,
      already: !result.created,
      service: service.name,
    });
  });
}

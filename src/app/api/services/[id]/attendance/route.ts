import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, HttpError } from "@/lib/tenant";
import { markAttendance } from "@/lib/attendance";

const markSchema = z.object({
  memberId: z.string().optional(),
  firstTimerId: z.string().optional(),
  method: z.enum(["MANUAL", "QR", "SELF_CHECKIN", "BULK"]).optional(),
});

// GET /api/services/:id/attendance — roster + who's already marked
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requireCtx();
    const service = await db.service.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!service) throw new HttpError(404, "Service not found");

    const [members, firstTimers, marked] = await Promise.all([
      db.member.findMany({
        where: { churchId: ctx.churchId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, phone: true },
        orderBy: { firstName: "asc" },
        take: 1000,
      }),
      db.firstTimer.findMany({
        where: { churchId: ctx.churchId, deletedAt: null, isConverted: false },
        select: { id: true, firstName: true, lastName: true, phone: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.attendance.findMany({
        where: { serviceId: params.id },
        select: { memberId: true, firstTimerId: true },
      }),
    ]);
    const markedMemberIds = marked.map((a) => a.memberId).filter(Boolean);
    const markedFirstTimerIds = marked.map((a) => a.firstTimerId).filter(Boolean);
    return NextResponse.json({ service, members, firstTimers, markedMemberIds, markedFirstTimerIds });
  });
}

// POST /api/services/:id/attendance — mark one person present
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requirePermission("attendance:write");
    const parsed = markSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid body");
    const d = parsed.data;
    if (!d.memberId && !d.firstTimerId) {
      throw new HttpError(422, "memberId or firstTimerId required");
    }
    const result = await markAttendance({
      churchId: ctx.churchId,
      serviceId: params.id,
      memberId: d.memberId,
      firstTimerId: d.firstTimerId,
      method: d.method ?? "MANUAL",
    });
    return NextResponse.json({ ok: true, ...result });
  });
}

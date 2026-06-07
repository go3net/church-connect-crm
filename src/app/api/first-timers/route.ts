import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, handle, tenantWhere } from "@/lib/tenant";
import { firstTimerSchema } from "@/lib/validations";
import { normalizePhone } from "@/lib/phone";
import { enrollPerson, advanceDueEnrollments } from "@/lib/automation";
import { audit } from "@/lib/audit";

// GET /api/first-timers?status=&q=
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("firsttimer:read");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const firstTimers = await db.firstTimer.findMany({
      where: tenantWhere(ctx, {
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      }),
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ firstTimers });
  });
}

// POST /api/first-timers  — register a guest, auto-enroll in follow-up journey
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("firsttimer:write");
    const json = await req.json();
    const parsed = firstTimerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const data = parsed.data;
    const phone = normalizePhone(data.phone);

    // dedupe on (church, phone)
    const existing = await db.firstTimer.findUnique({
      where: { churchId_phone: { churchId: ctx.churchId, phone } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A first-timer with this phone already exists", id: existing.id },
        { status: 409 }
      );
    }

    const firstTimer = await db.firstTimer.create({
      data: {
        churchId: ctx.churchId,
        branchId: data.branchId ?? ctx.branchId ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone,
        email: data.email || null,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address,
        howHeard: data.howHeard,
        invitedByName: data.invitedByName,
        prayerRequest: data.prayerRequest,
        wantsVisit: data.wantsVisit ?? false,
        firstServiceId: data.firstServiceId || null,
      },
    });

    // if a prayer request was captured, log it as a tracked PrayerRequest
    if (data.prayerRequest) {
      await db.prayerRequest.create({
        data: {
          churchId: ctx.churchId,
          branchId: firstTimer.branchId,
          firstTimerId: firstTimer.id,
          request: data.prayerRequest,
        },
      });
    }

    // enrol into the first-timer follow-up automation, then fire the Day-0 step now
    const enrollmentId = await enrollPerson({
      churchId: ctx.churchId,
      trigger: "FIRST_TIMER_REGISTERED",
      firstTimerId: firstTimer.id,
    });
    if (enrollmentId) {
      await advanceDueEnrollments({ churchId: ctx.churchId, limit: 25 }).catch(() => {});
    }

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "FirstTimer",
      entityId: firstTimer.id,
      description: `Registered first-timer ${firstTimer.firstName} ${firstTimer.lastName}`,
    });

    return NextResponse.json({ firstTimer, enrolled: !!enrollmentId }, { status: 201 });
  });
}

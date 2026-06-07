import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";
import { enrollPerson } from "@/lib/automation";
import { audit } from "@/lib/audit";

// POST /api/first-timers/:id/convert — promote FIRST_TIMER → MEMBER (non-destructive)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requirePermission("member:write");

    const ft = await db.firstTimer.findFirst({
      where: { id: params.id, churchId: ctx.churchId, deletedAt: null },
    });
    if (!ft) throw new HttpError(404, "First-timer not found");
    if (ft.isConverted) throw new HttpError(409, "Already converted");

    // guard against duplicate member phone
    const dupe = await db.member.findUnique({
      where: { churchId_phone: { churchId: ctx.churchId, phone: ft.phone } },
    });
    if (dupe) throw new HttpError(409, "A member with this phone already exists");

    const member = await db.$transaction(async (tx) => {
      const m = await tx.member.create({
        data: {
          churchId: ctx.churchId,
          branchId: ft.branchId,
          firstName: ft.firstName,
          lastName: ft.lastName,
          phone: ft.phone,
          email: ft.email,
          gender: ft.gender,
          dateOfBirth: ft.dateOfBirth,
          address: ft.address,
          status: "NEW_MEMBER",
          convertedFromFirstTimerId: ft.id,
          membershipDate: new Date(),
        },
      });
      await tx.firstTimer.update({
        where: { id: ft.id },
        data: { isConverted: true, convertedAt: new Date(), status: "NEW_MEMBER" },
      });
      // stop any active first-timer automation for this person
      await tx.automationEnrollment.updateMany({
        where: { firstTimerId: ft.id, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
      });
      return m;
    });

    // optionally start a new-member journey
    await enrollPerson({
      churchId: ctx.churchId,
      trigger: "NEW_CONVERT",
      memberId: member.id,
    }).catch(() => {});

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "PROMOTE",
      entity: "Member",
      entityId: member.id,
      description: `Converted first-timer ${ft.firstName} ${ft.lastName} to member`,
      metadata: { firstTimerId: ft.id },
    });

    return NextResponse.json({ member }, { status: 201 });
  });
}

import { db } from "@/lib/db";
import { enrollPerson } from "@/lib/automation";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/tenant";

/**
 * Promote a FirstTimer → Member (non-destructive). Shared by the manual
 * "Convert" action and the automatic second-attendance promotion.
 * Idempotent-ish: throws HttpError(409) if already converted or phone clash.
 */
export async function convertFirstTimer(opts: {
  churchId: string;
  firstTimerId: string;
  userId?: string | null;
  reason?: string;
}) {
  const ft = await db.firstTimer.findFirst({
    where: { id: opts.firstTimerId, churchId: opts.churchId, deletedAt: null },
  });
  if (!ft) throw new HttpError(404, "First-timer not found");
  if (ft.isConverted) throw new HttpError(409, "Already converted");

  const dupe = await db.member.findUnique({
    where: { churchId_phone: { churchId: opts.churchId, phone: ft.phone } },
  });
  if (dupe) throw new HttpError(409, "A member with this phone already exists");

  const member = await db.$transaction(async (tx) => {
    const m = await tx.member.create({
      data: {
        churchId: opts.churchId,
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
    await tx.automationEnrollment.updateMany({
      where: { firstTimerId: ft.id, status: "ACTIVE" },
      data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
    });
    return m;
  });

  await enrollPerson({
    churchId: opts.churchId,
    trigger: "NEW_CONVERT",
    memberId: member.id,
  }).catch(() => {});

  await audit({
    churchId: opts.churchId,
    userId: opts.userId,
    action: "PROMOTE",
    entity: "Member",
    entityId: member.id,
    description: `Converted first-timer ${ft.firstName} ${ft.lastName} to member${opts.reason ? ` (${opts.reason})` : ""}`,
    metadata: { firstTimerId: ft.id },
  });

  return member;
}

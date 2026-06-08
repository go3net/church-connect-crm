import type { AttendanceMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { convertFirstTimer } from "@/lib/conversion";

interface MarkInput {
  churchId: string;
  serviceId: string;
  memberId?: string | null;
  firstTimerId?: string | null;
  method?: AttendanceMethod;
}

/**
 * Mark a person present at a service (idempotent per person/service).
 * On a first-timer's SECOND counted attendance, auto-promote to Member.
 * Returns { created, promotedMemberId }.
 */
export async function markAttendance(input: MarkInput): Promise<{
  created: boolean;
  promotedMemberId?: string;
}> {
  const { churchId, serviceId } = input;
  const service = await db.service.findFirst({
    where: { id: serviceId, churchId },
    select: { id: true, branchId: true },
  });
  if (!service) throw new Error("Service not found");

  // idempotent insert
  const existing = await db.attendance.findFirst({
    where: {
      serviceId,
      ...(input.memberId ? { memberId: input.memberId } : { firstTimerId: input.firstTimerId }),
    },
  });
  if (existing) return { created: false };

  await db.attendance.create({
    data: {
      churchId,
      branchId: service.branchId,
      serviceId,
      memberId: input.memberId ?? null,
      firstTimerId: input.firstTimerId ?? null,
      method: input.method ?? "MANUAL",
    },
  });

  // keep the denormalized service counters fresh
  await db.service.update({
    where: { id: serviceId },
    data: {
      totalAttendees: { increment: 1 },
      ...(input.firstTimerId ? { totalFirstTimers: { increment: 1 } } : {}),
    },
  });

  // first-timer second-visit auto-promotion
  let promotedMemberId: string | undefined;
  if (input.firstTimerId) {
    const ft = await db.firstTimer.update({
      where: { id: input.firstTimerId },
      data: { visitCount: { increment: 1 } },
    });
    if (!ft.isConverted && ft.visitCount >= 2) {
      try {
        const member = await convertFirstTimer({
          churchId,
          firstTimerId: ft.id,
          reason: "second service attendance",
        });
        promotedMemberId = member.id;
      } catch {
        // ignore (e.g., phone clash) — keep attendance recorded
      }
    }
  }

  return { created: true, promotedMemberId };
}

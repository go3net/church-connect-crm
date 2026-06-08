import { NextRequest, NextResponse } from "next/server";
import { handle, assertCron } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const INACTIVE_DAYS = 30;

// POST /api/cron/inactivity-sweep — flag long-absent members + queue a re-engagement follow-up
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertCron(req);
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 864e5);

    // active members whose most recent attendance is older than the cutoff (or never)
    const stale = await db.$queryRaw<{ id: string; churchId: string; branchId: string | null; cellGroupId: string | null }[]>`
      SELECT m.id, m."churchId", m."branchId", m."cellGroupId"
      FROM "Member" m
      WHERE m."deletedAt" IS NULL
        AND m.status IN ('ACTIVE_MEMBER', 'NEW_MEMBER')
        AND NOT EXISTS (
          SELECT 1 FROM "Attendance" a
          WHERE a."memberId" = m.id AND a.present = true AND a."checkedInAt" >= ${cutoff}
        )
    `;

    let flagged = 0, tasksCreated = 0;
    for (const m of stale) {
      await db.member.update({ where: { id: m.id }, data: { status: "INACTIVE_MEMBER" } });
      flagged++;

      // skip if an open follow-up already exists
      const open = await db.followUp.findFirst({
        where: { memberId: m.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
        select: { id: true },
      });
      if (open) continue;

      // assign to the member's cell leader, else any admin/pastor
      const cell = m.cellGroupId
        ? await db.cellGroup.findUnique({ where: { id: m.cellGroupId }, select: { leaderId: true } })
        : null;
      const assigneeId =
        cell?.leaderId ??
        (await db.user.findFirst({
          where: { churchId: m.churchId, role: { in: ["CHURCH_ADMIN", "PASTOR"] }, isActive: true },
          select: { id: true },
        }))?.id;
      if (!assigneeId) continue;

      await db.followUp.create({
        data: {
          churchId: m.churchId,
          branchId: m.branchId,
          assignedToId: assigneeId,
          memberId: m.id,
          type: "CALL",
          status: "PENDING",
          dueDate: new Date(),
          notes: `Auto-flagged inactive — no attendance in ${INACTIVE_DAYS}+ days. Reach out to re-engage.`,
        },
      });
      tasksCreated++;
    }

    return NextResponse.json({ ok: true, flagged, tasksCreated });
  });
}

import { db } from "@/lib/db";

const RECENT_SERVICES = 8; // window for attendance rate

/**
 * Recompute the engagement score for every active member of a church.
 * Score (0–100) = 70% attendance rate + 30% recent follow-up responsiveness.
 * Flags inactivity when a member has not attended in the recent window.
 */
export async function recomputeEngagement(churchId: string): Promise<number> {
  const services = await db.service.findMany({
    where: { churchId },
    orderBy: { date: "desc" },
    take: RECENT_SERVICES,
    select: { id: true },
  });
  const serviceIds = services.map((s) => s.id);
  const windowSize = serviceIds.length || 1;

  const members = await db.member.findMany({
    where: { churchId, deletedAt: null },
    select: { id: true },
  });

  let updated = 0;
  for (const m of members) {
    const [presentCount, lastAtt, followUpCount] = await Promise.all([
      db.attendance.count({
        where: { memberId: m.id, present: true, serviceId: { in: serviceIds } },
      }),
      db.attendance.findFirst({
        where: { memberId: m.id, present: true },
        orderBy: { checkedInAt: "desc" },
        select: { checkedInAt: true },
      }),
      db.followUp.count({
        where: { memberId: m.id, status: "COMPLETED" },
      }),
    ]);

    const attendanceRate = presentCount / windowSize;
    const responsiveness = Math.min(followUpCount / 3, 1); // cap at 3 completed
    const score = Math.round(attendanceRate * 70 + responsiveness * 30);

    await db.engagementScore.upsert({
      where: { memberId: m.id },
      create: {
        churchId,
        memberId: m.id,
        score,
        attendanceRate,
        lastAttendedAt: lastAtt?.checkedInAt ?? null,
        followUpCount,
        trend: "flat",
        computedAt: new Date(),
      },
      update: {
        score,
        attendanceRate,
        lastAttendedAt: lastAtt?.checkedInAt ?? null,
        followUpCount,
        computedAt: new Date(),
      },
    });

    // auto-flag inactive members (no attendance in window)
    if (presentCount === 0) {
      await db.member.updateMany({
        where: { id: m.id, status: { in: ["ACTIVE_MEMBER", "NEW_MEMBER"] } },
        data: { status: "INACTIVE_MEMBER" },
      });
    }
    updated++;
  }
  return updated;
}

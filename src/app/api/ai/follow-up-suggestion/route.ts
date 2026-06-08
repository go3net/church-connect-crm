import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, handle, HttpError } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { generateFollowUpSuggestion, type PersonContext } from "@/lib/ai";

export const dynamic = "force-dynamic";

const schema = z.object({
  memberId: z.string().optional(),
  firstTimerId: z.string().optional(),
});

function daysAgo(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// POST /api/ai/follow-up-suggestion — AI next-step + draft message for a person
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    if (!can(ctx.role, "followup:write")) throw new HttpError(403, "Missing permission");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || (!parsed.data.memberId && !parsed.data.firstTimerId)) {
      throw new HttpError(422, "memberId or firstTimerId required");
    }

    const church = await db.church.findUnique({
      where: { id: ctx.churchId },
      select: { name: true },
    });

    let person: PersonContext;
    if (parsed.data.memberId) {
      const m = await db.member.findFirst({
        where: { id: parsed.data.memberId, churchId: ctx.churchId },
        include: {
          engagementScore: true,
          prayerRequests: { where: { status: { in: ["OPEN", "PRAYING"] } }, take: 1, orderBy: { createdAt: "desc" } },
          followUps: { orderBy: { updatedAt: "desc" }, take: 1 },
        },
      });
      if (!m) throw new HttpError(404, "Member not found");
      person = {
        firstName: m.firstName,
        status: m.status,
        isFirstTimer: false,
        lastAttendedDaysAgo: daysAgo(m.engagementScore?.lastAttendedAt),
        openPrayerRequest: m.prayerRequests[0]?.request ?? null,
        lastOutcome: m.followUps[0]?.outcome ?? null,
        churchName: church?.name ?? "our church",
      };
    } else {
      const f = await db.firstTimer.findFirst({
        where: { id: parsed.data.firstTimerId, churchId: ctx.churchId },
        include: {
          prayerRequests: { where: { status: { in: ["OPEN", "PRAYING"] } }, take: 1 },
          followUps: { orderBy: { updatedAt: "desc" }, take: 1 },
        },
      });
      if (!f) throw new HttpError(404, "First-timer not found");
      person = {
        firstName: f.firstName,
        status: f.status,
        isFirstTimer: true,
        lastAttendedDaysAgo: daysAgo(f.createdAt),
        openPrayerRequest: f.prayerRequest ?? f.prayerRequests[0]?.request ?? null,
        lastOutcome: f.followUps[0]?.outcome ?? null,
        churchName: church?.name ?? "our church",
      };
    }

    const suggestion = await generateFollowUpSuggestion(person);
    return NextResponse.json({ suggestion });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, handle, tenantWhere, HttpError } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { followUpSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

// GET /api/follow-ups?status=  — cell leaders see only their own
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    const seeAll = can(ctx.role, "followup:read:all");
    const seeOwn = can(ctx.role, "followup:read:own");
    if (!seeAll && !seeOwn) throw new HttpError(403, "Missing permission");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const followUps = await db.followUp.findMany({
      where: tenantWhere(ctx, {
        ...(seeAll ? {} : { assignedToId: ctx.userId }),
        ...(status ? { status: status as any } : {}),
      }),
      include: {
        member: { select: { firstName: true, lastName: true, phone: true } },
        firstTimer: { select: { firstName: true, lastName: true, phone: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 200,
    });
    return NextResponse.json({ followUps });
  });
}

// POST /api/follow-ups
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    if (!can(ctx.role, "followup:write")) throw new HttpError(403, "Missing permission");

    const parsed = followUpSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const data = parsed.data;
    if (!data.memberId && !data.firstTimerId) {
      throw new HttpError(422, "memberId or firstTimerId is required");
    }

    // cell leaders may only create follow-ups assigned to themselves
    const assignedToId = can(ctx.role, "assignment:manage")
      ? data.assignedToId ?? ctx.userId
      : ctx.userId;

    const followUp = await db.followUp.create({
      data: {
        churchId: ctx.churchId,
        branchId: ctx.branchId,
        assignedToId,
        memberId: data.memberId || null,
        firstTimerId: data.firstTimerId || null,
        type: data.type,
        status: "PENDING",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
      },
    });

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "FollowUp",
      entityId: followUp.id,
      description: `Created ${data.type} follow-up`,
    });

    return NextResponse.json({ followUp }, { status: 201 });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, handle, HttpError } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { followUpUpdateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

// PATCH /api/follow-ups/:id  — record outcome / mark complete
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requireCtx();
    if (!can(ctx.role, "followup:write")) throw new HttpError(403, "Missing permission");

    const existing = await db.followUp.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!existing) throw new HttpError(404, "Follow-up not found");

    // cell leaders can only update their own
    if (!can(ctx.role, "followup:read:all") && existing.assignedToId !== ctx.userId) {
      throw new HttpError(403, "Not your follow-up");
    }

    const parsed = followUpUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const data = parsed.data;
    const completing = data.status === "COMPLETED";

    const followUp = await db.followUp.update({
      where: { id: params.id },
      data: {
        status: data.status,
        outcome: data.outcome,
        notes: data.notes ?? existing.notes,
        completedAt: completing ? new Date() : existing.completedAt,
      },
    });

    // an outcome of NEEDS_PRAYER spins off a prayer request
    if (data.outcome === "NEEDS_PRAYER") {
      await db.prayerRequest.create({
        data: {
          churchId: ctx.churchId,
          branchId: existing.branchId,
          assignedToId: existing.assignedToId,
          memberId: existing.memberId,
          firstTimerId: existing.firstTimerId,
          request: data.notes || "Prayer needed (from follow-up)",
        },
      });
    }

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "FollowUp",
      entityId: followUp.id,
      description: `Updated follow-up → ${data.status ?? existing.status}${data.outcome ? ` / ${data.outcome}` : ""}`,
    });

    return NextResponse.json({ followUp });
  });
}

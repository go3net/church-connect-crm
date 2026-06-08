import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";

// DELETE /api/automation/steps/:stepId — remove a step (tenant-checked via workflow)
export async function DELETE(_req: NextRequest, { params }: { params: { stepId: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("automation:manage");
    const step = await db.automationStep.findUnique({
      where: { id: params.stepId },
      include: { workflow: { select: { churchId: true } } },
    });
    if (!step || step.workflow.churchId !== ctx.churchId) {
      throw new HttpError(404, "Step not found");
    }
    await db.automationStep.delete({ where: { id: step.id } });
    return NextResponse.json({ ok: true });
  });
}

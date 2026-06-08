import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/automation/:id — rename / toggle active
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("automation:manage");
    const wf = await db.automationWorkflow.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!wf) throw new HttpError(404, "Workflow not found");
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid body");
    const updated = await db.automationWorkflow.update({
      where: { id: wf.id },
      data: parsed.data,
    });
    return NextResponse.json({ workflow: updated });
  });
}

// DELETE /api/automation/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("automation:manage");
    const wf = await db.automationWorkflow.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!wf) throw new HttpError(404, "Workflow not found");
    await db.automationWorkflow.delete({ where: { id: wf.id } });
    return NextResponse.json({ ok: true });
  });
}

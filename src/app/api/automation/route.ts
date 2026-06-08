import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, tenantWhere } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z
    .enum(["FIRST_TIMER_REGISTERED", "NEW_CONVERT", "MEMBER_INACTIVE", "BIRTHDAY", "ANNIVERSARY", "MANUAL"])
    .optional(),
});

// GET /api/automation — workflows with ordered steps (+ template names)
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const workflows = await db.automationWorkflow.findMany({
      where: tenantWhere(ctx),
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: { template: { select: { id: true, name: true, channel: true } } },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ workflows });
  });
}

// POST /api/automation — create a workflow
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("automation:manage");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }
    const wf = await db.automationWorkflow.create({
      data: {
        churchId: ctx.churchId,
        name: parsed.data.name,
        description: parsed.data.description,
        trigger: parsed.data.trigger ?? "FIRST_TIMER_REGISTERED",
      },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "CREATE",
      entity: "AutomationWorkflow", entityId: wf.id, description: `Created workflow ${wf.name}`,
    });
    return NextResponse.json({ workflow: wf }, { status: 201 });
  });
}

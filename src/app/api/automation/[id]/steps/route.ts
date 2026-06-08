import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";

const schema = z.object({
  offsetDays: z.coerce.number().int().min(0),
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
  templateId: z.string().optional(),
  createsFollowUp: z.boolean().optional(),
  followUpType: z.enum(["CALL", "WHATSAPP", "HOME_VISIT", "PRAYER"]).optional(),
});

// POST /api/automation/:id/steps — append a step (auto-ordered)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("automation:manage");
    const wf = await db.automationWorkflow.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
      include: { steps: { orderBy: { order: "desc" }, take: 1 } },
    });
    if (!wf) throw new HttpError(404, "Workflow not found");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid step");

    const nextOrder = (wf.steps[0]?.order ?? 0) + 1;
    const step = await db.automationStep.create({
      data: {
        workflowId: wf.id,
        order: nextOrder,
        offsetDays: parsed.data.offsetDays,
        channel: parsed.data.channel,
        templateId: parsed.data.templateId || null,
        createsFollowUp: parsed.data.createsFollowUp ?? false,
        followUpType: parsed.data.followUpType,
      },
    });
    return NextResponse.json({ step }, { status: 201 });
  });
}

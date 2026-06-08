import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, tenantWhere } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  leaderId: z.string().optional(),
  meetingDay: z.string().optional(),
  meetingTime: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  branchId: z.string().optional(),
});

// GET /api/cell-groups — list with leader + member count
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const groups = await db.cellGroup.findMany({
      where: tenantWhere(ctx, { deletedAt: null }),
      include: {
        leader: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ groups });
  });
}

// POST /api/cell-groups
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cellgroup:manage");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;
    const group = await db.cellGroup.create({
      data: {
        churchId: ctx.churchId,
        branchId: d.branchId ?? ctx.branchId ?? null,
        leaderId: d.leaderId || null,
        name: d.name,
        meetingDay: d.meetingDay,
        meetingTime: d.meetingTime,
        location: d.location,
        description: d.description,
      },
    });
    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "CellGroup",
      entityId: group.id,
      description: `Created cell group ${group.name}`,
    });
    return NextResponse.json({ group }, { status: 201 });
  });
}

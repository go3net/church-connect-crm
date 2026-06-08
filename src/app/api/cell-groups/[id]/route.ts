import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, HttpError } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  leaderId: z.string().nullable().optional(),
  meetingDay: z.string().optional(),
  meetingTime: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  // member assignment ops
  addMemberIds: z.array(z.string()).optional(),
  removeMemberIds: z.array(z.string()).optional(),
});

// GET /api/cell-groups/:id — group + its members
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requireCtx();
    const group = await db.cellGroup.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
      include: { leader: { select: { id: true, name: true } } },
    });
    if (!group) throw new HttpError(404, "Cell group not found");
    const members = await db.member.findMany({
      where: { churchId: ctx.churchId, cellGroupId: group.id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: "asc" },
    });
    return NextResponse.json({ group, members });
  });
}

// PATCH /api/cell-groups/:id — update fields and/or (un)assign members
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requirePermission("cellgroup:manage");
    const group = await db.cellGroup.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!group) throw new HttpError(404, "Cell group not found");

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid body");
    const d = parsed.data;

    if (d.addMemberIds?.length) {
      await db.member.updateMany({
        where: { id: { in: d.addMemberIds }, churchId: ctx.churchId },
        data: { cellGroupId: group.id },
      });
    }
    if (d.removeMemberIds?.length) {
      await db.member.updateMany({
        where: { id: { in: d.removeMemberIds }, churchId: ctx.churchId, cellGroupId: group.id },
        data: { cellGroupId: null },
      });
    }

    const updated = await db.cellGroup.update({
      where: { id: group.id },
      data: {
        name: d.name,
        leaderId: d.leaderId === undefined ? undefined : d.leaderId,
        meetingDay: d.meetingDay,
        meetingTime: d.meetingTime,
        location: d.location,
        description: d.description,
      },
    });

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: d.addMemberIds || d.removeMemberIds ? "ASSIGN" : "UPDATE",
      entity: "CellGroup",
      entityId: group.id,
      description: `Updated cell group ${updated.name}`,
    });

    return NextResponse.json({ group: updated });
  });
}

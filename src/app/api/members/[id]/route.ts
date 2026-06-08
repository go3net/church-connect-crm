import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, HttpError } from "@/lib/tenant";
import { memberSchema } from "@/lib/validations";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/members/:id
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requireCtx();
    const member = await db.member.findFirst({
      where: { id: params.id, churchId: ctx.churchId, deletedAt: null },
      include: { cellGroup: { select: { id: true, name: true } } },
    });
    if (!member) throw new HttpError(404, "Member not found");
    return NextResponse.json({ member });
  });
}

// PATCH /api/members/:id — edit profile
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("member:write");
    const member = await db.member.findFirst({
      where: { id: params.id, churchId: ctx.churchId, deletedAt: null },
    });
    if (!member) throw new HttpError(404, "Member not found");

    const parsed = memberSchema.partial().safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid input");
    const d = parsed.data;

    const updated = await db.member.update({
      where: { id: member.id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone ? normalizePhone(d.phone) : undefined,
        email: d.email === "" ? null : d.email,
        gender: d.gender,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : undefined,
        maritalStatus: d.maritalStatus,
        weddingDate: d.weddingDate ? new Date(d.weddingDate) : undefined,
        address: d.address,
        city: d.city,
        occupation: d.occupation,
        status: d.status,
        cellGroupId: d.cellGroupId === "" ? null : d.cellGroupId,
      },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "UPDATE",
      entity: "Member", entityId: member.id, description: `Edited member ${updated.firstName} ${updated.lastName}`,
    });
    return NextResponse.json({ member: updated });
  });
}

// DELETE /api/members/:id — soft delete
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("member:write");
    const member = await db.member.findFirst({
      where: { id: params.id, churchId: ctx.churchId, deletedAt: null },
    });
    if (!member) throw new HttpError(404, "Member not found");
    await db.member.update({ where: { id: member.id }, data: { deletedAt: new Date(), isActive: false } });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "DELETE",
      entity: "Member", entityId: member.id, description: `Removed member ${member.firstName} ${member.lastName}`,
    });
    return NextResponse.json({ ok: true });
  });
}

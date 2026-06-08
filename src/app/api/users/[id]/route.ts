import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  role: z.enum(["PASTOR", "CHURCH_ADMIN", "CELL_LEADER"]).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/users/:id — change role / activate / deactivate a staff member
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requirePermission("user:manage");
    if (params.id === ctx.userId) throw new HttpError(400, "You cannot modify your own account here");

    const user = await db.user.findFirst({
      where: { id: params.id, churchId: ctx.churchId, deletedAt: null },
    });
    if (!user) throw new HttpError(404, "Staff member not found");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid body");

    const updated = await db.user.update({
      where: { id: user.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "UPDATE",
      entity: "User", entityId: user.id,
      description: `Updated staff ${user.name}${parsed.data.isActive === false ? " (deactivated)" : ""}`,
    });
    return NextResponse.json({ user: updated });
  });
}

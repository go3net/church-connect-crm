import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, handle, tenantWhere } from "@/lib/tenant";
import { memberSchema } from "@/lib/validations";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";

// GET /api/members?status=&q=&cellGroupId=
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("member:read");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const cellGroupId = searchParams.get("cellGroupId");
    const q = searchParams.get("q");

    const members = await db.member.findMany({
      where: tenantWhere(ctx, {
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
        ...(cellGroupId ? { cellGroupId } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      }),
      include: { cellGroup: { select: { name: true } }, engagementScore: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ members });
  });
}

// POST /api/members
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("member:write");
    const parsed = memberSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const data = parsed.data;
    const phone = normalizePhone(data.phone);

    const existing = await db.member.findUnique({
      where: { churchId_phone: { churchId: ctx.churchId, phone } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A member with this phone already exists", id: existing.id },
        { status: 409 }
      );
    }

    const member = await db.member.create({
      data: {
        churchId: ctx.churchId,
        branchId: data.branchId ?? ctx.branchId ?? null,
        cellGroupId: data.cellGroupId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone,
        email: data.email || null,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        maritalStatus: data.maritalStatus,
        weddingDate: data.weddingDate ? new Date(data.weddingDate) : null,
        address: data.address,
        city: data.city,
        occupation: data.occupation,
        status: data.status ?? "NEW_MEMBER",
      },
    });

    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "Member",
      entityId: member.id,
      description: `Added member ${member.firstName} ${member.lastName}`,
    });

    return NextResponse.json({ member }, { status: 201 });
  });
}

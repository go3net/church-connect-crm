import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle, tenantWhere } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/users?role=CELL_LEADER&all=1 — staff directory (tenant-scoped)
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    const role = req.nextUrl.searchParams.get("role");
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const users = await db.user.findMany({
      where: tenantWhere(ctx, {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        ...(role ? { role: role as any } : {}),
      }),
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  });
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["PASTOR", "CHURCH_ADMIN", "CELL_LEADER"]),
});

// POST /api/users — add a staff member (PASTOR/SUPER_ADMIN only)
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("user:manage");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 422 }
      );
    }
    const email = parsed.data.email.toLowerCase().trim();
    if (await db.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }

    // enforce plan staff limit
    const sub = await db.subscription.findUnique({
      where: { churchId: ctx.churchId },
      include: { plan: { select: { maxStaff: true } } },
    });
    const staffCount = await db.user.count({ where: { churchId: ctx.churchId, isActive: true, deletedAt: null } });
    if (sub?.plan && staffCount >= sub.plan.maxStaff) {
      return NextResponse.json(
        { error: `Your plan allows ${sub.plan.maxStaff} staff. Upgrade to add more.` },
        { status: 402 }
      );
    }

    const user = await db.user.create({
      data: {
        churchId: ctx.churchId,
        branchId: ctx.branchId,
        name: parsed.data.name,
        email,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.role,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "CREATE",
      entity: "User", entityId: user.id, description: `Added staff ${user.name} (${user.role})`,
    });
    return NextResponse.json({ user }, { status: 201 });
  });
}

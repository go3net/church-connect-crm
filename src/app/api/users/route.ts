import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, handle, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// GET /api/users?role=CELL_LEADER — staff directory (tenant-scoped)
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    const role = req.nextUrl.searchParams.get("role");
    const users = await db.user.findMany({
      where: tenantWhere(ctx, {
        deletedAt: null,
        isActive: true,
        ...(role ? { role: role as any } : {}),
      }),
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  });
}

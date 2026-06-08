import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, handle, tenantWhere } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// GET /api/templates — message templates for the church
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const templates = await db.messageTemplate.findMany({
      where: tenantWhere(ctx, { isActive: true }),
      select: { id: true, name: true, channel: true, subject: true, body: true, category: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ templates });
  });
}

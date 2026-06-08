import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireCtx, handle, tenantWhere } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const serviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["SUNDAY", "MIDWEEK", "SPECIAL", "CELL_MEETING"]).optional(),
  date: z.string(),
  startTime: z.string().optional(),
  theme: z.string().optional(),
  preacher: z.string().optional(),
  branchId: z.string().optional(),
});

// GET /api/services
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const services = await db.service.findMany({
      where: tenantWhere(ctx),
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json({ services });
  });
}

// POST /api/services
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance:write");
    const parsed = serviceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;
    const service = await db.service.create({
      data: {
        churchId: ctx.churchId,
        branchId: d.branchId ?? ctx.branchId ?? null,
        name: d.name,
        type: d.type ?? "SUNDAY",
        date: new Date(d.date),
        startTime: d.startTime,
        theme: d.theme,
        preacher: d.preacher,
      },
    });
    await audit({
      churchId: ctx.churchId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "Service",
      entityId: service.id,
      description: `Created service ${service.name}`,
    });
    return NextResponse.json({ service }, { status: 201 });
  });
}

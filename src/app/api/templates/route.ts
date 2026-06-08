import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle } from "@/lib/tenant";
import { tenantWhere } from "@/lib/tenant";
import { audit } from "@/lib/audit";

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

const createSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
  body: z.string().min(1),
  subject: z.string().optional(),
  category: z.string().optional(),
});

// POST /api/templates — create a message template
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("template:manage");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }
    const template = await db.messageTemplate.create({
      data: { churchId: ctx.churchId, ...parsed.data },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "CREATE",
      entity: "MessageTemplate", entityId: template.id, description: `Created template ${template.name}`,
    });
    return NextResponse.json({ template }, { status: 201 });
  });
}

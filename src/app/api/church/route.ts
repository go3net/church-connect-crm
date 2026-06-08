import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, requirePermission, handle } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/church — current church profile + messaging config
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const church = await db.church.findUnique({
      where: { id: ctx.churchId },
      select: {
        id: true, name: true, email: true, phone: true, address: true, city: true, state: true,
        country: true, timezone: true, logoUrl: true, currency: true, waPhoneId: true, senderId: true,
      },
    });
    return NextResponse.json({ church });
  });
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().optional(),
  waPhoneId: z.string().optional(),
  senderId: z.string().optional(),
});

// PATCH /api/church — update church profile + messaging credentials
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("church:manage");
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }
    const d = parsed.data;
    const church = await db.church.update({
      where: { id: ctx.churchId },
      data: { ...d, email: d.email === "" ? null : d.email },
      select: { id: true, name: true },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "UPDATE",
      entity: "Church", entityId: church.id, description: "Updated church settings",
    });
    return NextResponse.json({ church });
  });
}

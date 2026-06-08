import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, handle, tenantWhere, HttpError } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/prayer-requests?status=
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    const status = req.nextUrl.searchParams.get("status");
    const requests = await db.prayerRequest.findMany({
      where: tenantWhere(ctx, { ...(status ? { status: status as any } : {}) }),
      include: {
        member: { select: { firstName: true, lastName: true } },
        firstTimer: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    });
    return NextResponse.json({ requests });
  });
}

const createSchema = z.object({
  request: z.string().min(2),
  requesterName: z.string().optional(),
  memberId: z.string().optional(),
  firstTimerId: z.string().optional(),
  isConfidential: z.boolean().optional(),
});

// POST /api/prayer-requests — log a standalone prayer request
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requireCtx();
    if (!can(ctx.role, "prayer:write")) throw new HttpError(403, "Missing permission");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Request text required");
    const pr = await db.prayerRequest.create({
      data: {
        churchId: ctx.churchId,
        branchId: ctx.branchId,
        request: parsed.data.request,
        requesterName: parsed.data.requesterName,
        memberId: parsed.data.memberId || null,
        firstTimerId: parsed.data.firstTimerId || null,
        isConfidential: parsed.data.isConfidential ?? false,
      },
    });
    await audit({
      churchId: ctx.churchId, userId: ctx.userId, action: "CREATE",
      entity: "PrayerRequest", entityId: pr.id, description: "Logged prayer request",
    });
    return NextResponse.json({ request: pr }, { status: 201 });
  });
}

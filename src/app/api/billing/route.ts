import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCtx, handle } from "@/lib/tenant";
import { getBillingState } from "@/lib/billing";

export const dynamic = "force-dynamic";

// GET /api/billing — current subscription, plan, usage + available plans
export async function GET() {
  return handle(async () => {
    const ctx = await requireCtx();
    const [state, plans] = await Promise.all([
      getBillingState(ctx.churchId),
      db.plan.findMany({ where: { isActive: true }, orderBy: { priceKobo: "asc" } }),
    ]);
    return NextResponse.json({ ...state, plans });
  });
}

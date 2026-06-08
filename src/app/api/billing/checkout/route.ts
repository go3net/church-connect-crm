import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, handle, HttpError } from "@/lib/tenant";
import { initTransaction } from "@/lib/paystack";

export const dynamic = "force-dynamic";

const schema = z.object({ planId: z.string().min(1) });

// POST /api/billing/checkout — start a Paystack transaction for a plan
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("billing:manage");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "planId required");

    const plan = await db.plan.findUnique({ where: { id: parsed.data.planId } });
    if (!plan || !plan.isActive) throw new HttpError(404, "Plan not found");
    if (plan.priceKobo <= 0) throw new HttpError(400, "Free plan needs no payment");

    const [church, user] = await Promise.all([
      db.church.findUnique({ where: { id: ctx.churchId }, select: { email: true } }),
      db.user.findUnique({ where: { id: ctx.userId }, select: { email: true } }),
    ]);
    const email = church?.email || user?.email;
    if (!email) throw new HttpError(400, "No billing email on file");

    const base = process.env.NEXTAUTH_URL ?? "";
    const init = await initTransaction({
      email,
      amountKobo: plan.priceKobo,
      callbackUrl: `${base}/billing?status=success`,
      metadata: { churchId: ctx.churchId, planId: plan.id, type: "subscription" },
    });

    return NextResponse.json({ authorizationUrl: init.authorization_url, reference: init.reference });
  });
}

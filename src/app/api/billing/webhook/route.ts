import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { activateSubscription } from "@/lib/billing";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/billing/webhook — Paystack events (charge.success)
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (event?.event === "charge.success") {
    const data = event.data;
    const meta = data?.metadata ?? {};
    if (meta.type === "subscription" && meta.churchId && meta.planId) {
      try {
        await activateSubscription({
          churchId: meta.churchId,
          planId: meta.planId,
          reference: data.reference,
          amountKobo: data.amount,
        });
        await audit({
          churchId: meta.churchId,
          action: "UPDATE",
          entity: "Subscription",
          description: `Subscription activated via Paystack (${data.reference})`,
          metadata: { planId: meta.planId, amount: data.amount },
        });
      } catch (err) {
        console.error("[paystack webhook] activation failed", err);
        // 200 anyway so Paystack doesn't hammer retries on our bug; logged for triage
      }
    }
  }

  return NextResponse.json({ received: true });
}

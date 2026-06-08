import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

// GET — Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

// POST — delivery status callbacks + inbound replies
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};

        // 1) delivery/read status updates
        for (const s of value.statuses ?? []) {
          const mapped = STATUS_MAP[s.status];
          if (!mapped || !s.id) continue;
          const log = await db.communicationLog.findFirst({
            where: { providerMessageId: s.id },
            select: { id: true },
          });
          if (!log) continue;
          await db.communicationLog.update({
            where: { id: log.id },
            data: {
              status: mapped,
              ...(mapped === "DELIVERED" ? { deliveredAt: new Date() } : {}),
              ...(mapped === "READ" ? { readAt: new Date() } : {}),
              ...(mapped === "FAILED" ? { errorMessage: s.errors?.[0]?.title ?? "Delivery failed" } : {}),
            },
          });
        }

        // 2) inbound messages → log + mark prior outbound REPLIED
        for (const m of value.messages ?? []) {
          const phone = normalizePhone(m.from ?? "");
          const text = m.text?.body ?? `[${m.type ?? "message"}]`;

          // find the matching outbound thread to attribute church/person
          const prior = await db.communicationLog.findFirst({
            where: { channel: "WHATSAPP", direction: "OUTBOUND", toAddress: { contains: phone.replace("+", "") } },
            orderBy: { createdAt: "desc" },
          });
          if (!prior) continue;

          await db.communicationLog.create({
            data: {
              churchId: prior.churchId,
              branchId: prior.branchId,
              memberId: prior.memberId,
              firstTimerId: prior.firstTimerId,
              channel: "WHATSAPP",
              direction: "INBOUND",
              toAddress: phone,
              body: text,
              status: "DELIVERED",
              providerMessageId: m.id,
            },
          });
          // mark the latest outbound to this person as REPLIED
          await db.communicationLog.update({
            where: { id: prior.id },
            data: { status: "REPLIED", repliedAt: new Date() },
          });
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp webhook] processing error", err);
  }

  // always 200 so Meta doesn't disable the webhook
  return NextResponse.json({ received: true });
}

import type { SendResult } from "./types";

const LIVE = process.env.MESSAGING_LIVE === "true";
const GRAPH = "https://graph.facebook.com/v20.0";

/**
 * Send a WhatsApp message via Meta Cloud API.
 * For approved template sends pass `templateName`; otherwise a free-form text
 * body is sent (only valid inside the 24h customer-service window).
 */
export async function sendWhatsApp(opts: {
  to: string; // E.164 without leading + is also accepted by Meta
  body: string;
  templateName?: string | null;
  phoneNumberId?: string | null; // per-church override
}): Promise<SendResult> {
  const phoneId = opts.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = opts.to.replace(/^\+/, "");

  if (!LIVE || !phoneId || !token) {
    console.log(`[whatsapp:dev] → ${opts.to}: ${opts.body}`);
    return { status: "SENT", providerMessageId: `dev_wa_${Date.now()}` };
  }

  const payload = opts.templateName
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: opts.templateName, language: { code: "en" } },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: opts.body },
      };

  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: "FAILED", error: data?.error?.message ?? "WhatsApp send failed" };
    }
    return { status: "SENT", providerMessageId: data?.messages?.[0]?.id };
  } catch (err: any) {
    return { status: "FAILED", error: err?.message ?? "WhatsApp network error" };
  }
}

import type { SendResult } from "./types";

const LIVE = process.env.MESSAGING_LIVE === "true";

/**
 * Send an SMS via Termii (primary). Falls back to dev-log when not live.
 * Twilio fallback is stubbed for the MVP.
 */
export async function sendSms(opts: {
  to: string; // E.164
  body: string;
  senderId?: string | null; // per-church override
}): Promise<SendResult> {
  const apiKey = process.env.TERMII_API_KEY;
  const from = opts.senderId || process.env.TERMII_SENDER_ID || "ChurchCRM";

  if (!LIVE || !apiKey) {
    console.log(`[sms:dev] → ${opts.to} (${from}): ${opts.body}`);
    return { status: "SENT", providerMessageId: `dev_sms_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: opts.to.replace(/^\+/, ""),
        from,
        sms: opts.body,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    });
    const data = await res.json();
    if (!res.ok || data?.code !== "ok") {
      return { status: "FAILED", error: data?.message ?? "Termii send failed" };
    }
    return { status: "SENT", providerMessageId: data?.message_id };
  } catch (err: any) {
    return { status: "FAILED", error: err?.message ?? "SMS network error" };
  }
}

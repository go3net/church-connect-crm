import type { SendResult } from "./types";

const LIVE = process.env.MESSAGING_LIVE === "true";

/** Send an email via Resend (REST). Dev-logs when not live. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string; // plain text / simple html
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Church Connect <hello@example.com>";

  if (!LIVE || !apiKey) {
    console.log(`[email:dev] → ${opts.to} | ${opts.subject}: ${opts.body}`);
    return { status: "SENT", providerMessageId: `dev_email_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: `<div style="font-family:sans-serif;line-height:1.6">${opts.body.replace(/\n/g, "<br/>")}</div>`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: "FAILED", error: data?.message ?? "Resend send failed" };
    }
    return { status: "SENT", providerMessageId: data?.id };
  } catch (err: any) {
    return { status: "FAILED", error: err?.message ?? "Email network error" };
  }
}

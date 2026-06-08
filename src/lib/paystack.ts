import crypto from "crypto";

const SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE = "https://api.paystack.co";

export interface InitResult {
  authorization_url: string;
  reference: string;
  access_code: string;
}

/** Initialize a Paystack transaction. amountKobo is in kobo (₦ * 100). */
export async function initTransaction(opts: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitResult> {
  if (!SECRET) throw new Error("PAYSTACK_SECRET_KEY not configured");
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? "Paystack init failed");
  }
  return data.data as InitResult;
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  metadata: Record<string, unknown>;
}> {
  if (!SECRET) throw new Error("PAYSTACK_SECRET_KEY not configured");
  const res = await fetch(`${BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error("Verification failed");
  return data.data;
}

/** Validate the x-paystack-signature header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!SECRET || !signature) return false;
  const hash = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
  return hash === signature;
}

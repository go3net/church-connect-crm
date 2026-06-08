import type { Channel } from "@prisma/client";
import { db } from "@/lib/db";
import { sendWhatsApp } from "./whatsapp";
import { sendSms } from "./sms";
import { sendEmail } from "./email";

export { sendWhatsApp, sendSms, sendEmail };

/** Replace {{var}} tokens in a template body. Unknown tokens are left blank. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | undefined>
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    (vars[key] ?? "").toString()
  );
}

export interface DispatchPerson {
  memberId?: string | null;
  firstTimerId?: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
}

export interface DispatchInput {
  churchId: string;
  branchId?: string | null;
  channel: Channel;
  person: DispatchPerson;
  body: string;
  subject?: string | null;
  templateId?: string | null;
  enrollmentId?: string | null;
  senderId?: string | null; // User who triggered; null = system
  // per-church provider overrides
  waPhoneId?: string | null;
  smsSenderId?: string | null;
  waTemplateName?: string | null;
}

/** Render + persist a QUEUED CommunicationLog row WITHOUT sending. Returns log id. */
export async function enqueueMessage(input: DispatchInput): Promise<string> {
  const vars = {
    firstName: input.person.firstName,
    lastName: input.person.lastName,
    fullName: `${input.person.firstName} ${input.person.lastName}`.trim(),
  };
  const body = renderTemplate(input.body, vars);
  const subject = input.subject ? renderTemplate(input.subject, vars) : null;
  const toAddress =
    input.channel === "EMAIL" ? input.person.email ?? "" : input.person.phone;

  const log = await db.communicationLog.create({
    data: {
      churchId: input.churchId,
      branchId: input.branchId ?? null,
      senderId: input.senderId ?? null,
      memberId: input.person.memberId ?? null,
      firstTimerId: input.person.firstTimerId ?? null,
      templateId: input.templateId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      channel: input.channel,
      direction: "OUTBOUND",
      toAddress,
      subject,
      body,
      status: toAddress ? "QUEUED" : "FAILED",
      errorMessage: toAddress ? null : "No destination address",
    },
  });
  return log.id;
}

/** Send one already-persisted QUEUED log via its channel provider + update status. */
async function deliverLog(
  log: {
    id: string; churchId: string; channel: Channel; toAddress: string;
    body: string; subject: string | null;
  },
  creds: { waPhoneId?: string | null; senderId?: string | null }
): Promise<boolean> {
  if (!log.toAddress) {
    await db.communicationLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: "No destination address" },
    });
    return false;
  }

  let result;
  if (log.channel === "WHATSAPP") {
    result = await sendWhatsApp({ to: log.toAddress, body: log.body, phoneNumberId: creds.waPhoneId });
  } else if (log.channel === "SMS") {
    result = await sendSms({ to: log.toAddress, body: log.body, senderId: creds.senderId });
  } else {
    result = await sendEmail({ to: log.toAddress, subject: log.subject ?? "", body: log.body });
  }

  await db.communicationLog.update({
    where: { id: log.id },
    data: {
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorMessage: result.error,
      costKobo: result.costKobo,
      sentAt: result.status === "SENT" ? new Date() : null,
    },
  });

  if (result.status === "SENT") {
    await db.subscription
      .updateMany({ where: { churchId: log.churchId }, data: { messagesUsed: { increment: 1 } } })
      .catch(() => {});
  }
  return result.status === "SENT";
}

/**
 * Drain QUEUED outbound messages (broadcast queue + any enqueued sends).
 * Caches church creds per tenant to avoid N+1 lookups. Used by the
 * broadcast-dispatch cron and for an immediate small drain after a broadcast.
 */
export async function dispatchQueuedMessages(limit = 200): Promise<{ sent: number; failed: number }> {
  const queued = await db.communicationLog.findMany({
    where: { status: "QUEUED", direction: "OUTBOUND" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const churchCache = new Map<string, { waPhoneId?: string | null; senderId?: string | null }>();
  let sent = 0, failed = 0;
  for (const log of queued) {
    let creds = churchCache.get(log.churchId);
    if (!creds) {
      const c = await db.church.findUnique({ where: { id: log.churchId }, select: { waPhoneId: true, senderId: true } });
      creds = { waPhoneId: c?.waPhoneId, senderId: c?.senderId };
      churchCache.set(log.churchId, creds);
    }
    const ok = await deliverLog(log, creds).catch(() => false);
    ok ? sent++ : failed++;
  }
  return { sent, failed };
}

/**
 * Enqueue + send immediately. Single source of truth for transactional sends
 * (automation steps, birthday/anniversary jobs) where volume per call is small.
 */
export async function dispatchMessage(input: DispatchInput): Promise<string> {
  const id = await enqueueMessage(input);
  const log = await db.communicationLog.findUnique({ where: { id } });
  if (log && log.status === "QUEUED") {
    await deliverLog(log, { waPhoneId: input.waPhoneId, senderId: input.smsSenderId }).catch(() => {});
  }
  return id;
}

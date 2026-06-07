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

/**
 * Render → send via the channel provider → persist a CommunicationLog row.
 * Returns the created log id. Single source of truth for all outbound messages.
 */
export async function dispatchMessage(input: DispatchInput): Promise<string> {
  const vars = {
    firstName: input.person.firstName,
    lastName: input.person.lastName,
    fullName: `${input.person.firstName} ${input.person.lastName}`.trim(),
  };
  const body = renderTemplate(input.body, vars);
  const subject = input.subject ? renderTemplate(input.subject, vars) : null;

  const toAddress =
    input.channel === "EMAIL" ? input.person.email ?? "" : input.person.phone;

  // create the log row up front (QUEUED) so nothing is ever lost
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
      status: "QUEUED",
    },
  });

  if (!toAddress) {
    await db.communicationLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: "No destination address" },
    });
    return log.id;
  }

  let result;
  if (input.channel === "WHATSAPP") {
    result = await sendWhatsApp({
      to: toAddress,
      body,
      templateName: input.waTemplateName,
      phoneNumberId: input.waPhoneId,
    });
  } else if (input.channel === "SMS") {
    result = await sendSms({ to: toAddress, body, senderId: input.smsSenderId });
  } else {
    result = await sendEmail({ to: toAddress, subject: subject ?? "", body });
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

  // best-effort usage metering
  if (result.status === "SENT") {
    await db.subscription
      .updateMany({
        where: { churchId: input.churchId },
        data: { messagesUsed: { increment: 1 } },
      })
      .catch(() => {});
  }

  return log.id;
}

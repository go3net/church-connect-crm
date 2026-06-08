import type { Channel } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueueMessage, type DispatchPerson } from "@/lib/messaging";

export const SEGMENTS = [
  { value: "members_all", label: "All members" },
  { value: "members_active", label: "Active members" },
  { value: "members_inactive", label: "Inactive members" },
  { value: "members_new", label: "New members & converts" },
  { value: "firsttimers", label: "First timers (not yet converted)" },
] as const;

const MAX_RECIPIENTS = 1000;

async function resolveRecipients(
  churchId: string,
  segment: string
): Promise<DispatchPerson[]> {
  // dynamic cell-group segment: "cell_<id>"
  if (segment.startsWith("cell_")) {
    const cellGroupId = segment.slice(5);
    const ms = await db.member.findMany({
      where: { churchId, cellGroupId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      take: MAX_RECIPIENTS,
    });
    return ms.map((m) => ({ memberId: m.id, ...m }));
  }

  if (segment === "firsttimers") {
    const fts = await db.firstTimer.findMany({
      where: { churchId, isConverted: false, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      take: MAX_RECIPIENTS,
    });
    return fts.map((f) => ({ firstTimerId: f.id, ...f }));
  }

  const statusFilter =
    segment === "members_active"
      ? { status: "ACTIVE_MEMBER" as const }
      : segment === "members_inactive"
        ? { status: "INACTIVE_MEMBER" as const }
        : segment === "members_new"
          ? { status: { in: ["NEW_MEMBER", "NEW_CONVERT"] as ("NEW_MEMBER" | "NEW_CONVERT")[] } }
          : {};

  const ms = await db.member.findMany({
    where: { churchId, deletedAt: null, ...statusFilter },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    take: MAX_RECIPIENTS,
  });
  return ms.map((m) => ({ memberId: m.id, ...m }));
}

/**
 * Queue a one-off broadcast to a segment. Renders + persists a QUEUED
 * CommunicationLog per recipient (fast); the broadcast-dispatch cron drains
 * the queue (and the API drains a first batch immediately for instant feedback
 * on small sends). This keeps the request fast and survives large lists.
 */
export async function sendBroadcast(opts: {
  churchId: string;
  senderId: string;
  channel: Channel;
  segment: string;
  body: string;
  subject?: string | null;
  templateId?: string | null;
}): Promise<{ recipients: number }> {
  const recipients = await resolveRecipients(opts.churchId, opts.segment);

  let queued = 0;
  for (const person of recipients) {
    // skip recipients lacking an address for the chosen channel
    if (opts.channel === "EMAIL" && !person.email) continue;
    await enqueueMessage({
      churchId: opts.churchId,
      channel: opts.channel,
      person,
      body: opts.body,
      subject: opts.subject,
      templateId: opts.templateId,
      senderId: opts.senderId,
    }).catch(() => {});
    queued++;
  }

  return { recipients: queued };
}

import type { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";

interface AuditInput {
  churchId: string | null;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Fire-and-forget audit trail write. Never throws into the request path. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        churchId: input.churchId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata as any,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write", err);
  }
}

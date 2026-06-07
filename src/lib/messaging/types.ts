import type { MessageStatus } from "@prisma/client";

export interface SendResult {
  status: Extract<MessageStatus, "SENT" | "FAILED">;
  providerMessageId?: string;
  error?: string;
  costKobo?: number;
}

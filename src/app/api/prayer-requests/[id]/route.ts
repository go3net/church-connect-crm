import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCtx, handle, HttpError } from "@/lib/tenant";
import { can } from "@/lib/rbac";

const patchSchema = z.object({
  status: z.enum(["OPEN", "PRAYING", "ANSWERED", "CLOSED"]).optional(),
  answerNote: z.string().optional(),
});

// PATCH /api/prayer-requests/:id — update status / record answer
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requireCtx();
    if (!can(ctx.role, "prayer:write")) throw new HttpError(403, "Missing permission");
    const pr = await db.prayerRequest.findFirst({
      where: { id: params.id, churchId: ctx.churchId },
    });
    if (!pr) throw new HttpError(404, "Prayer request not found");
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(422, "Invalid body");
    const answered = parsed.data.status === "ANSWERED";
    const updated = await db.prayerRequest.update({
      where: { id: pr.id },
      data: {
        status: parsed.data.status,
        answerNote: parsed.data.answerNote ?? pr.answerNote,
        answeredAt: answered ? new Date() : pr.answeredAt,
      },
    });
    return NextResponse.json({ request: updated });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handle } from "@/lib/tenant";
import { convertFirstTimer } from "@/lib/conversion";

// POST /api/first-timers/:id/convert — promote FIRST_TIMER → MEMBER (non-destructive)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const ctx = await requirePermission("member:write");
    const member = await convertFirstTimer({
      churchId: ctx.churchId,
      firstTimerId: params.id,
      userId: ctx.userId,
    });
    return NextResponse.json({ member }, { status: 201 });
  });
}

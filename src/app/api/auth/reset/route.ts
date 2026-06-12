import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/reset — consume a reset token and set a new password
export async function POST(req: NextRequest) {
  return handle(async () => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
    }
    const vt = await db.verificationToken.findUnique({ where: { token: parsed.data.token } });
    if (!vt || vt.expires < new Date()) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { email: vt.identifier } });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
      }),
      db.verificationToken.deleteMany({ where: { identifier: vt.identifier } }),
    ]);
    return NextResponse.json({ ok: true });
  });
}

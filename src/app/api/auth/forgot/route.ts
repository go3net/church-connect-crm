import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { handle } from "@/lib/tenant";
import { sendEmail } from "@/lib/messaging";
import { rateLimit, rateLimitResponse, getIP, sweepBuckets } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email() });

// POST /api/auth/forgot — issue a password-reset link (always returns ok; no enumeration)
export async function POST(req: NextRequest) {
  return handle(async () => {
    sweepBuckets();
    if (!rateLimit(`forgot:${getIP(req)}`, 3, 600_000)) return rateLimitResponse();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: true });
    const email = parsed.data.email.toLowerCase().trim();

    const user = await db.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.deletedAt) {
      const token = randomBytes(32).toString("hex");
      await db.verificationToken.deleteMany({ where: { identifier: email } });
      await db.verificationToken.create({
        data: { identifier: email, token, expires: new Date(Date.now() + 3600_000) },
      });
      const base = process.env.NEXTAUTH_URL ?? "";
      const link = `${base}/reset?token=${token}`;
      await sendEmail({
        to: email,
        subject: "Reset your Church Connect password",
        body: `Hello ${user.name},\n\nWe received a request to reset your password. Click the link below to set a new one (valid for 1 hour):\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  });
}

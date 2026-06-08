import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle } from "@/lib/tenant";
import { normalizePhone } from "@/lib/phone";
import { provisionChurchDefaults, ensurePlansAndGetFree } from "@/lib/provision";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  churchName: z.string().min(2),
  adminName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "church";
}

// POST /api/signup — public church self-registration
export async function POST(req: NextRequest) {
  return handle(async () => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 422 }
      );
    }
    const d = parsed.data;
    const email = d.email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // unique slug
    const base = slugify(d.churchName);
    let slug = base;
    for (let n = 1; await db.church.findUnique({ where: { slug } }); n++) {
      slug = `${base}-${n}`;
    }

    const freePlanId = await ensurePlansAndGetFree();
    const passwordHash = await bcrypt.hash(d.password, 10);

    const { church, user } = await db.$transaction(async (tx) => {
      const church = await tx.church.create({
        data: { name: d.churchName, slug, email, phone: d.phone ? normalizePhone(d.phone) : null },
      });
      const branch = await tx.branch.create({
        data: { churchId: church.id, name: "Main Branch", isMain: true },
      });
      const user = await tx.user.create({
        data: {
          churchId: church.id,
          branchId: branch.id,
          name: d.adminName,
          email,
          phone: d.phone ? normalizePhone(d.phone) : null,
          passwordHash,
          role: "PASTOR", // church owner gets full church-wide access incl. billing
        },
      });
      await tx.subscription.create({
        data: {
          churchId: church.id,
          planId: freePlanId,
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 864e5),
        },
      });
      return { church, user };
    });

    // default templates + first-timer journey (outside the tx; idempotent)
    await provisionChurchDefaults(church.id);

    await audit({
      churchId: church.id,
      userId: user.id,
      action: "CREATE",
      entity: "Church",
      entityId: church.id,
      description: `Church "${church.name}" self-registered`,
    });

    return NextResponse.json({ ok: true, email }, { status: 201 });
  });
}

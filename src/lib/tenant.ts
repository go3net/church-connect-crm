import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";

export interface Ctx {
  userId: string;
  role: UserRole;
  churchId: string; // guaranteed non-null for tenant-scoped routes
  branchId: string | null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Resolve the authenticated, tenant-scoped context for an API route.
 * Throws HttpError(401) if unauthenticated, HttpError(403) if the user has no
 * church (SUPER_ADMIN must act through an explicit church selector elsewhere).
 */
export async function requireCtx(): Promise<Ctx> {
  const session = await auth();
  if (!session?.user) throw new HttpError(401, "Not authenticated");

  const { id, role, churchId, branchId } = session.user;
  if (!churchId) {
    throw new HttpError(403, "No church context — SUPER_ADMIN must select a church");
  }
  return { userId: id, role, churchId, branchId };
}

/** Resolve context and assert a permission, else throw 403. */
export async function requirePermission(permission: Permission): Promise<Ctx> {
  const ctx = await requireCtx();
  if (!can(ctx.role, permission)) {
    throw new HttpError(403, `Missing permission: ${permission}`);
  }
  return ctx;
}

/** Build the mandatory tenant filter for any Prisma `where`. */
export function tenantWhere(ctx: Ctx, extra: Record<string, unknown> = {}) {
  return { churchId: ctx.churchId, ...extra };
}

/** Wrap an API handler so HttpError becomes a clean JSON response. */
export function handle(
  fn: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  return fn().catch((err) => {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api] unhandled error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  });
}

/** Verify the cron secret on protected /api/cron/* routes. */
export function assertCron(req: Request): void {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    throw new HttpError(401, "Invalid cron secret");
  }
}

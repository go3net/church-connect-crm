import type { UserRole } from "@prisma/client";

/**
 * Role-based access control.
 *
 * Permissions are coarse-grained capabilities checked in API routes and the UI.
 * The 4 roles (highest → lowest reach):
 *   SUPER_ADMIN  — platform owner, crosses all tenants
 *   PASTOR       — church-wide read, broadcasts, assignments
 *   CHURCH_ADMIN — registers people, attendance, comms
 *   CELL_LEADER  — only their assigned members: follow-ups, visit/call/prayer
 */
export type Permission =
  | "church:manage"
  | "user:manage"
  | "member:read"
  | "member:write"
  | "firsttimer:read"
  | "firsttimer:write"
  | "attendance:write"
  | "cellgroup:manage"
  | "assignment:manage"
  | "followup:read:all"
  | "followup:read:own"
  | "followup:write"
  | "prayer:write"
  | "broadcast:send"
  | "report:read"
  | "billing:manage"
  | "platform:admin";

const MATRIX: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "platform:admin",
    "church:manage",
    "user:manage",
    "member:read",
    "member:write",
    "firsttimer:read",
    "firsttimer:write",
    "attendance:write",
    "cellgroup:manage",
    "assignment:manage",
    "followup:read:all",
    "followup:write",
    "prayer:write",
    "broadcast:send",
    "report:read",
    "billing:manage",
  ],
  PASTOR: [
    "user:manage",
    "member:read",
    "member:write",
    "firsttimer:read",
    "firsttimer:write",
    "attendance:write",
    "cellgroup:manage",
    "assignment:manage",
    "followup:read:all",
    "followup:write",
    "prayer:write",
    "broadcast:send",
    "report:read",
    "billing:manage",
  ],
  CHURCH_ADMIN: [
    "member:read",
    "member:write",
    "firsttimer:read",
    "firsttimer:write",
    "attendance:write",
    "cellgroup:manage",
    "assignment:manage",
    "followup:read:all",
    "followup:write",
    "prayer:write",
    "broadcast:send",
    "report:read",
  ],
  CELL_LEADER: [
    "member:read",
    "firsttimer:read",
    "followup:read:own",
    "followup:write",
    "prayer:write",
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function rolePermissions(role: UserRole): Permission[] {
  return MATRIX[role] ?? [];
}

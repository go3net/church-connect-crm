import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      churchId: string | null;
      branchId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    churchId: string | null;
    branchId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: UserRole;
    churchId: string | null;
    branchId: string | null;
  }
}

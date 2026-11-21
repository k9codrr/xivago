import type { Role } from "@slotbook/db";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isAdmin: boolean;
      isBanned: boolean;
      phoneVerified: boolean;
      createdAt: string;
      isPro: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    isBanned: boolean;
    phoneVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isBanned: boolean;
    phoneVerified: boolean;
    createdAt: string;
    isPro: boolean;
  }
}

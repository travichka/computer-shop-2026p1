import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { readAuthEnv, sharedAuthOptions } from "@/lib/auth-options";
import { getPrisma } from "@/lib/db";

// Runtime Better Auth instance of the app: shared provider/model settings plus the Prisma adapter
// over the one PrismaClient (PrismaPg) from lib/db.ts — no second client for authentication.
// Missing auth variables stop the server with an explicit error here (readAuthEnv).
export const auth = betterAuth({
  ...sharedAuthOptions(readAuthEnv()),
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
});

import "server-only";

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

// One client (and one pg connection pool) per server process. In development the module is
// re-evaluated on every hot reload, so the instance is kept on globalThis to avoid new pools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Shared client, created on first use — importing this module does not need DATABASE_URL. */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient(process.env.DATABASE_URL);
  return globalForPrisma.prisma;
}

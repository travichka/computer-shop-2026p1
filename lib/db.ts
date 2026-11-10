import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPool, createPrismaClientWithPool } from "@/lib/prisma-client";

// One client (and one pg connection pool) per server process — not one for the whole cloud:
// every Vercel instance has its own pool, so the pool is small (lib/prisma-client.ts).
// In development the module is re-evaluated on every hot reload, so the instance is kept on
// globalThis to avoid new pools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createAppClient(): PrismaClient {
  const pool = createPool(process.env.DATABASE_URL);
  // Fluid Compute: lets Vercel close idle connections before an instance is suspended,
  // so they are not leaked on the database side. Outside Vercel it does nothing.
  attachDatabasePool(pool);
  return createPrismaClientWithPool(pool);
}

/** Shared client, created on first use — importing this module does not need DATABASE_URL. */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createAppClient();
  return globalForPrisma.prisma;
}

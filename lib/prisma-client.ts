import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * New PrismaClient over the pg driver adapter. The app shares one instance (lib/db.ts);
 * scripts, the seed and tests create their own and close it with $disconnect() in finally.
 * Deliberately not server-only, so tsx scripts can import it.
 */
export function createPrismaClient(connectionString: string | undefined): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set — copy .env.example to .env.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

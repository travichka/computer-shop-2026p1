import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/** Defaults of the app pool: small, because every cloud instance has its own pool (Lab 10). */
export const DEFAULT_POOL_MAX = 5;
export const POOL_IDLE_TIMEOUT_MS = 5_000;
export const POOL_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * pg pool settings for one server process. `max` limits the connections of THIS process only;
 * the whole deployment may open (number of instances) × max, so it is kept far below the
 * database/pooler limit. DATABASE_POOL_MAX overrides the default (1..50). TLS comes from the
 * connection string (sslmode=verify-full on the remote database); certificate checks stay on.
 */
export function poolConfig(connectionString: string, env: Partial<Record<string, string>> = process.env): pg.PoolConfig {
  const raw = env.DATABASE_POOL_MAX?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_POOL_MAX;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 50.");
  }
  return {
    connectionString,
    max: parsed,
    // Idle connections are closed quickly, so a suspended instance does not hold database slots.
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    // A sleeping serverless database may need a few seconds to wake up.
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
  };
}

/** New pg pool for the given database; the caller owns it (see lib/db.ts). */
export function createPool(connectionString: string | undefined): pg.Pool {
  if (!connectionString) throw new Error("DATABASE_URL is not set — copy .env.example to .env.");
  return new pg.Pool(poolConfig(connectionString));
}

/**
 * New PrismaClient over the pg driver adapter. The app shares one instance (lib/db.ts);
 * scripts, the seed and tests create their own and close it with $disconnect() in finally.
 * Deliberately not server-only, so tsx scripts can import it.
 */
export function createPrismaClient(connectionString: string | undefined): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set — copy .env.example to .env.");
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(connectionString)) });
}

/** PrismaClient over an existing pool (the pool stays owned by the caller). */
export function createPrismaClientWithPool(pool: pg.Pool): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

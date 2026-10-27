import { config } from "dotenv";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

config({ quiet: true });

const TEST_DB_NAME = /^[a-z0-9_]+_test$/;

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/**
 * TEST_DATABASE_URL, but only if it clearly points at a separate test database: the name must end
 * with _test and differ from the application database in DATABASE_URL. Guards every destructive step.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set — see .env.example.");
  const name = databaseName(url);
  if (!TEST_DB_NAME.test(name)) throw new Error(`Refusing to use "${name}": the test database name must end with _test.`);
  if (process.env.DATABASE_URL && databaseName(process.env.DATABASE_URL) === name) {
    throw new Error(`Refusing to use "${name}": it is the application database (DATABASE_URL).`);
  }
  return url;
}

export function testDatabaseName(): string {
  return databaseName(testDatabaseUrl());
}

export function createTestClient(): PrismaClient {
  return createPrismaClient(testDatabaseUrl());
}

/** Empties all shop tables — after checking that the live connection really is the test database. */
export async function resetDatabase(client: PrismaClient): Promise<void> {
  const [{ current_database: connected }] = await client.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (connected !== testDatabaseName()) {
    throw new Error(`Refusing to clean "${connected}": expected the test database "${testDatabaseName()}".`);
  }
  await client.$executeRawUnsafe(
    'TRUNCATE "OrderItem", "Order", "CartItem", "Cart", "User", "Product", "Category" RESTART IDENTITY CASCADE',
  );
}

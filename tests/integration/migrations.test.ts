import { readdirSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createTestClient, testDatabaseUrl } from "./test-db";

describe("test database guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a database whose name does not end with _test", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://u:p@localhost:5432/shop");
    expect(() => testDatabaseUrl()).toThrow(/must end with _test/);
  });

  it("refuses the application database even if named *_test", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://u:p@localhost:5432/app_test");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app_test");
    expect(() => testDatabaseUrl()).toThrow(/application database/);
  });
});

// The test database was created empty and migrated only by `prisma migrate deploy` (global-setup.ts).
const client = createTestClient();
afterAll(() => client.$disconnect());

describe("migrations on an empty database", () => {
  it("applies the whole migration history", async () => {
    const onDisk = readdirSync(new URL("../../prisma/migrations", import.meta.url)).filter((name) => /^\d+_/.test(name));
    const applied = await client.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`;
    expect(applied.map((row) => row.migration_name)).toEqual(onDisk.sort());
  });

  it("recreates COLLATE \"C\" on nameSortKey from the migration SQL", async () => {
    const [column] = await client.$queryRaw<{ collation_name: string | null }[]>`
      SELECT collation_name FROM information_schema.columns
      WHERE table_name = 'Product' AND column_name = 'nameSortKey'`;
    expect(column.collation_name).toBe("C");
  });

  it("recreates the CHECK constraints", async () => {
    const rows = await client.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE contype = 'c' AND conrelid <> 0 ORDER BY conname`;
    expect(rows.map((row) => row.conname)).toEqual([
      "cart_item_quantity_range",
      "category_code_format",
      "order_item_code_format",
      "order_item_line_total_consistent",
      "order_item_quantity_positive",
      "order_item_unit_price_nonnegative",
      "order_number_format",
      "order_total_nonnegative",
      "product_amount_nonnegative",
      "product_code_format",
      "product_id_positive",
      "product_name_not_blank",
      "product_price_nonnegative",
      "user_email_format",
    ]);
  });

  it("keeps a single unique index on Product.code (no duplicate index)", async () => {
    const rows = await client.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'Product' AND indexdef LIKE '%(code)%'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("UNIQUE");
  });
});

describe("auth_cart migration (Lab 09)", () => {
  it("creates the Better Auth tables next to the single User table", async () => {
    const rows = await client.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('User', 'Session', 'Account', 'Verification', 'user', 'session')
      ORDER BY table_name`;
    expect(rows.map((row) => row.table_name)).toEqual(["Account", "Session", "User", "Verification"]);
  });

  it("makes session tokens and provider accounts unique", async () => {
    const rows = await client.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE%'
        AND tablename IN ('Session', 'Account') ORDER BY indexname`;
    expect(rows.map((row) => row.indexname)).toEqual([
      "Account_pkey",
      "Account_providerId_accountId_key",
      "Session_pkey",
      "Session_token_key",
    ]);
  });

  it("restricts deleting a product in a cart and cascades user → session/account/cart", async () => {
    const rows = await client.$queryRaw<{ conname: string; confdeltype: string }[]>`
      SELECT conname, confdeltype::text FROM pg_constraint
      WHERE conname IN ('CartItem_productId_fkey', 'Session_userId_fkey', 'Account_userId_fkey', 'Cart_userId_fkey')
      ORDER BY conname`;
    // r = RESTRICT, c = CASCADE
    expect(rows.map((row) => [row.conname, row.confdeltype])).toEqual([
      ["Account_userId_fkey", "c"],
      ["CartItem_productId_fkey", "r"],
      ["Cart_userId_fkey", "c"],
      ["Session_userId_fkey", "c"],
    ]);
  });
});

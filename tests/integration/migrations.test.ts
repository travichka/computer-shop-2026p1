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

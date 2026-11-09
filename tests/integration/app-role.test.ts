import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./test-db";

// Lab 10: the runtime role from scripts/sql/grant-app-role.sql may read and write data in the
// migrated tables (and in tables of future migrations), but cannot change the schema.
const ROLE = "shop_app_it_test";
const PASSWORD = "app-role-test-password";
const sql = readFileSync(new URL("../../scripts/sql/grant-app-role.sql", import.meta.url), "utf8").replaceAll(
  "shop_app",
  ROLE,
);

const owner = new pg.Client({ connectionString: testDatabaseUrl() });
let app: pg.Client;

function appUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.username = ROLE;
  url.password = PASSWORD;
  return url.toString();
}

async function dropRole() {
  const exists = await owner.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [ROLE]);
  if (exists.rowCount) {
    await owner.query(`DROP OWNED BY "${ROLE}"`);
    await owner.query(`DROP ROLE "${ROLE}"`);
  }
}

beforeAll(async () => {
  await owner.connect();
  await owner.query(`DROP TABLE IF EXISTS "FutureMigrationTable"`);
  await dropRole();
  await owner.query(`CREATE ROLE "${ROLE}" WITH LOGIN PASSWORD '${PASSWORD}'`);
  await owner.query(sql);
  await owner.query(sql); // idempotent
  app = new pg.Client({ connectionString: appUrl() });
  await app.connect();
});

afterAll(async () => {
  await app?.end();
  await owner.query(`DROP TABLE IF EXISTS "FutureMigrationTable"`);
  await dropRole();
  await owner.end();
});

describe("runtime role (grant-app-role.sql)", () => {
  it("reads and writes data of the migrated tables, including sequences", async () => {
    await expect(app.query(`SELECT count(*) FROM "Product"`)).resolves.toBeDefined();
    const category = await app.query<{ id: number }>(
      `INSERT INTO "Category" (code, name) VALUES ('approle', 'Rola') RETURNING id`,
    );
    expect(category.rows[0].id).toBeGreaterThan(0);
    await app.query(`UPDATE "Category" SET name = 'Rola 2' WHERE code = 'approle'`);
    await app.query(`DELETE FROM "Category" WHERE code = 'approle'`);
  });

  it("cannot change the schema or read the migration history", async () => {
    await expect(app.query(`CREATE TABLE "Hack" (id int)`)).rejects.toThrow(/permission denied/);
    await expect(app.query(`DROP TABLE "CartItem"`)).rejects.toThrow(/must be owner|permission denied/);
    await expect(app.query(`ALTER TABLE "Product" DROP CONSTRAINT product_price_nonnegative`)).rejects.toThrow(
      /must be owner|permission denied/,
    );
    await expect(app.query(`SELECT * FROM "_prisma_migrations"`)).rejects.toThrow(/permission denied/);
  });

  it("gets access to tables created later by the owner (future migrations)", async () => {
    await owner.query(`CREATE TABLE "FutureMigrationTable" (id SERIAL PRIMARY KEY, note TEXT)`);
    const row = await app.query(`INSERT INTO "FutureMigrationTable" (note) VALUES ('ok') RETURNING id`);
    expect(row.rowCount).toBe(1);
  });
});

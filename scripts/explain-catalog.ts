// Extension "Indeksy i zapytania": EXPLAIN (ANALYZE, BUFFERS) of the catalog query on a larger,
// separate data set, without and with composite indexes.  npm run db:explain [-- <rows>]
// Uses its own database (<TEST_DATABASE_URL name with _test → _bench>), never the shop database.
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { toProductOrderBy, toProductWhere } from "@/lib/products/prisma-repository";
import type { ProductCriteria } from "@/lib/products/types";

config({ quiet: true });

const ROWS = Number(process.argv[2] ?? 200_000);
const source = process.env.TEST_DATABASE_URL;
if (!source || !/_test$/.test(new URL(source).pathname)) throw new Error("TEST_DATABASE_URL (…_test) is required.");
const benchUrl = new URL(source);
benchUrl.pathname = benchUrl.pathname.replace(/_test$/, "_bench");
const benchName = benchUrl.pathname.slice(1);

const INDEXES = [
  'CREATE INDEX "Product_categoryId_nameSortKey_id_idx" ON "Product" ("categoryId", "nameSortKey", "id")',
  'CREATE INDEX "Product_categoryId_date_id_idx" ON "Product" ("categoryId", "date" DESC, "id")',
];
const DROP_INDEXES = [
  'DROP INDEX IF EXISTS "Product_categoryId_nameSortKey_id_idx"',
  'DROP INDEX IF EXISTS "Product_categoryId_date_id_idx"',
];

async function recreateDatabase() {
  const admin = new URL(benchUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${benchName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${benchName}"`);
  } finally {
    await client.end();
  }
  const prisma = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));
  execFileSync(prisma, ["migrate", "deploy"], { env: { ...process.env, DATABASE_URL: benchUrl.toString() }, stdio: "pipe" });
}

/** Deterministic synthetic catalog: ~1/3 out of stock, 4 categories, pseudo-random names and dates. */
const FILL = (from: number, to: number) => `
  INSERT INTO "Product" (id, code, name, "nameSortKey", description, image, price, amount, date, "categoryId")
  SELECT g, 'B' || lpad(g::text, 9, '0'), 'Produkt ' || md5(g::text), md5(g::text), 'Opis',
         '/images/products/cpu.webp', (g * 7919) % 500000,
         CASE WHEN g % 3 = 0 THEN 0 ELSE g % 50 + 1 END,
         timestamptz '2020-01-01 00:00:00+00' + ((g * 7919) % 157680000) * interval '1 second',
         (g % 4) + 1
  FROM generate_series(${from}, ${to}) AS g`;

async function main() {
  await recreateDatabase();
  const db = new pg.Client({ connectionString: benchUrl.toString() });
  await db.connect();

  // Prisma Client with query events: the EXPLAIN below runs the SQL that the repository really sends.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: benchUrl.toString() }),
    log: [{ emit: "event", level: "query" }],
  });
  let lastQuery = { sql: "", params: [] as unknown[] };
  prisma.$on("query", (event) => {
    lastQuery = { sql: event.query, params: JSON.parse(event.params) as unknown[] };
  });

  try {
    await db.query(`INSERT INTO "Category" (id, code, name) VALUES (1,'cpu','Procesor'),(2,'gpu','Karta graficzna'),(3,'ram','Pamięć RAM'),(4,'disk','Dysk')`);
    await db.query(FILL(1, ROWS));
    await db.query("ANALYZE");

    // "relation": the repository's filter category: { code } (JOIN on Category, id unknown at plan time).
    // "categoryId": the same query when the category id is already known (WHERE "categoryId" = $1).
    const gpu = { type: "gpu", stock: "available" } as const;
    const cases: Array<{ label: string; criteria: ProductCriteria; byId?: boolean; take?: number }> = [
      { label: "relation filter, sort=name, whole list", criteria: { ...gpu, sort: "name" } },
      { label: "relation filter, sort=newest, whole list", criteria: { ...gpu, sort: "newest" } },
      { label: "relation filter, sort=name, first 24", criteria: { ...gpu, sort: "name" }, take: 24 },
      { label: "categoryId filter, sort=name, whole list", criteria: { ...gpu, sort: "name" }, byId: true },
      { label: "categoryId filter, sort=newest, first 24", criteria: { ...gpu, sort: "newest" }, byId: true, take: 24 },
      { label: "categoryId filter, sort=name, first 24", criteria: { ...gpu, sort: "name" }, byId: true, take: 24 },
    ];

    const explain = async () => {
      const out: string[] = [];
      for (const { label, criteria, byId, take } of cases) {
        const where = byId ? { categoryId: 2, amount: { gt: 0 } } : toProductWhere(criteria);
        await prisma.product.findMany({ where, orderBy: toProductOrderBy(criteria.sort), take, select: { id: true } });
        const { rows } = await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${lastQuery.sql}`, lastQuery.params);
        const plan = rows.map((row: Record<string, string>) => row["QUERY PLAN"]);
        const nodes = plan
          .filter((line: string) => /(Scan|Sort|Limit|Join|Hash)( |$)/.test(line) && !/Sort (Key|Method)/.test(line))
          .map((line: string) => line.trim().replace(/^->\s*/, "").replace(/\s+\(cost.*$/, ""));
        const time = plan.find((line: string) => line.startsWith("Execution Time"));
        const buffers = plan.find((line: string) => line.trim().startsWith("Buffers"))?.trim();
        out.push(`  ${label}\n    plan: ${nodes.join(" → ")}\n    ${buffers ?? ""}\n    ${time}`);
      }
      return out.join("\n");
    };

    const insertCost = async () => {
      const start = performance.now();
      await db.query(FILL(ROWS + 1, ROWS + 20_000));
      const ms = performance.now() - start;
      await db.query(`DELETE FROM "Product" WHERE id > ${ROWS}`);
      await db.query("VACUUM ANALYZE \"Product\"");
      return ms;
    };

    console.log(`Rows: ${ROWS} products (${benchName}); SQL captured from Prisma:\n  ${lastQuery.sql || "(captured per query below)"}\n`);
    for (const sql of DROP_INDEXES) await db.query(sql);
    console.log("BEFORE (only Product_categoryId_idx):");
    console.log(await explain());
    console.log(`  insert of 20 000 rows: ${(await insertCost()).toFixed(0)} ms`);

    for (const sql of INDEXES) await db.query(sql);
    await db.query("ANALYZE");
    console.log("\nAFTER (+ (categoryId, nameSortKey, id) and (categoryId, date DESC, id)):");
    console.log(await explain());
    console.log(`  insert of 20 000 rows: ${(await insertCost()).toFixed(0)} ms`);

    const { rows: sizes } = await db.query(
      `SELECT indexrelname AS name, pg_size_pretty(pg_relation_size(indexrelid)) AS size
       FROM pg_stat_user_indexes WHERE relname = 'Product' ORDER BY indexrelname`,
    );
    const { rows: table } = await db.query(`SELECT pg_size_pretty(pg_relation_size('"Product"')) AS size`);
    console.log(`\nSizes: table ${table[0].size}; ` + sizes.map((s: { name: string; size: string }) => `${s.name} ${s.size}`).join(", "));
    console.log(`Example SQL: ${lastQuery.sql}`);
  } finally {
    await prisma.$disconnect();
    await db.end();
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

// Backup of a database and its restore into a SEPARATE test database (Lab 10, extension
// "Backup i restore"). The source is only read; Production is never overwritten.
//   BACKUP_SOURCE_URL=<direct URL of the source>   (default: DATABASE_URL)
//   RESTORE_DATABASE_URL=<URL of a database whose name ends with _test>
//   npm run db:backup-restore
// pg_dump/pg_restore 17 run in the postgres:17 container (Docker), so no local client is needed
// and the client version matches the PostgreSQL 17 server. Connection strings are passed to the
// container through environment variables, never on a command line. The dump goes to backups/
// (git-ignored). Afterwards the catalog, relations and carts of both databases are compared.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { describeTarget, formatTarget } from "./lib/db-target";

config({ quiet: true });

const source = process.env.BACKUP_SOURCE_URL ?? process.env.DATABASE_URL;
const target = process.env.RESTORE_DATABASE_URL;
if (!source || !target) {
  console.error("Set BACKUP_SOURCE_URL (or DATABASE_URL) and RESTORE_DATABASE_URL.");
  process.exit(2);
}
const src = describeTarget(source);
const dst = describeTarget(target);
if (!/_test$/.test(dst.database)) {
  console.error(`Refusing to restore into "${dst.database}": the target name must end with _test.`);
  process.exit(2);
}
if (src.host === dst.host && src.port === dst.port && src.database === dst.database) {
  console.error("Refusing to restore into the source database.");
  process.exit(2);
}
console.log(`Source: ${formatTarget(src)}`);
console.log(`Target: ${formatTarget(dst)}`);

/** Inside the container "localhost" is the container itself; Docker Desktop exposes the host. */
function forDocker(url: string): string {
  const parsed = new URL(url);
  if (["localhost", "127.0.0.1"].includes(parsed.hostname)) parsed.hostname = "host.docker.internal";
  return parsed.toString();
}

const dir = resolve("backups");
mkdirSync(dir, { recursive: true });
const file = `${src.database}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;

function docker(script: string, env: Record<string, string>) {
  const envArgs = Object.keys(env).flatMap((name) => ["-e", name]);
  execFileSync(
    "docker",
    ["run", "--rm", ...envArgs, "-v", `${dir}:/backup`, "--add-host=host.docker.internal:host-gateway", "postgres:17", "sh", "-c", script],
    { env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] },
  );
}

// 1. Backup (custom format: compressed, restorable selectively; no owners/grants of the source roles).
let started = performance.now();
docker(`pg_dump "$SRC" --format=custom --no-owner --no-privileges --file="/backup/${file}"`, { SRC: forDocker(source) });
console.log(`Backup:  backups/${file} (${((performance.now() - started) / 1000).toFixed(1)} s)`);

// 2. Empty target database (only the _test one).
const admin = new URL(target);
admin.pathname = "/postgres";
const adminClient = new pg.Client({ connectionString: admin.toString() });
await adminClient.connect();
await adminClient.query(`DROP DATABASE IF EXISTS "${dst.database}" WITH (FORCE)`);
await adminClient.query(`CREATE DATABASE "${dst.database}"`);
await adminClient.end();

// 3. Restore; any error stops it.
started = performance.now();
docker(`pg_restore --dbname="$DST" --no-owner --no-privileges --exit-on-error "/backup/${file}"`, { DST: forDocker(target) });
console.log(`Restore: ${dst.database} (${((performance.now() - started) / 1000).toFixed(1)} s)`);

// 4. Verification: same rows (count + checksum of all rows) in every table, intact relations.
const TABLES = ["_prisma_migrations", "Category", "Product", "User", "Account", "Session", "Verification", "Cart", "CartItem", "Order", "OrderItem"];
const ORPHANS: Record<string, string> = {
  "Product without category": `SELECT count(*) FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE c.id IS NULL`,
  "Cart without user": `SELECT count(*) FROM "Cart" c LEFT JOIN "User" u ON u.id = c."userId" WHERE u.id IS NULL`,
  "CartItem without cart/product": `SELECT count(*) FROM "CartItem" i LEFT JOIN "Cart" c ON c.id = i."cartId" LEFT JOIN "Product" p ON p.id = i."productId" WHERE c.id IS NULL OR p.id IS NULL`,
  "Session without user": `SELECT count(*) FROM "Session" s LEFT JOIN "User" u ON u.id = s."userId" WHERE u.id IS NULL`,
};

async function fingerprint(url: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tables: Record<string, string> = {};
    for (const table of TABLES) {
      const { rows } = await client.query<{ n: string; md5: string }>(
        `SELECT count(*) AS n, md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS md5 FROM "${table}" t`,
      );
      tables[table] = `${rows[0].n} rows ${rows[0].md5.slice(0, 12)}`;
    }
    const orphans: Record<string, number> = {};
    for (const [name, sql] of Object.entries(ORPHANS)) orphans[name] = Number((await client.query(sql)).rows[0].count);
    const schema = await client.query<{ checks: string; fks: string; collation: string }>(
      `SELECT (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'c') AS checks,
              (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'f') AS fks,
              (SELECT collation_name FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'nameSortKey') AS collation`,
    );
    return { tables, orphans, schema: schema.rows[0] };
  } finally {
    await client.end();
  }
}

const [before, after] = await Promise.all([fingerprint(source), fingerprint(target)]);
let ok = true;
console.log(`\n| table | source | restored | same |\n|---|---|---|---|`);
for (const table of TABLES) {
  const same = before.tables[table] === after.tables[table];
  ok &&= same;
  console.log(`| ${table} | ${before.tables[table]} | ${after.tables[table]} | ${same ? "yes" : "NO"} |`);
}
for (const [name, count] of Object.entries(after.orphans)) {
  ok &&= count === 0;
  console.log(`${name}: ${count}`);
}
const schemaSame = JSON.stringify(before.schema) === JSON.stringify(after.schema);
ok &&= schemaSame && after.schema.collation === "C";
console.log(
  `CHECK ${after.schema.checks}, FK ${after.schema.fks}, nameSortKey COLLATE ${after.schema.collation} — ` +
    `${schemaSame ? "same as source" : "DIFFERENT from source"}`,
);
console.log(ok ? "\nRestore verified." : "\nRestore verification FAILED.");
process.exitCode = ok ? 0 : 1;

// Extension "Zapis współbieżny": two concurrent attempts to take the last unit of a product.
//   npm run db:race [-- <rounds>]
// Runs on its own scratch database (<TEST_DATABASE_URL name with _test → _race>), never on the shop data.
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";
import { reserveStock } from "@/lib/products/stock";

config({ quiet: true });

const ROUNDS = Number(process.argv[2] ?? 50);
const source = process.env.TEST_DATABASE_URL;
if (!source || !/_test$/.test(new URL(source).pathname)) throw new Error("TEST_DATABASE_URL (…_test) is required.");
const raceUrl = new URL(source);
raceUrl.pathname = raceUrl.pathname.replace(/_test$/, "_race");
const raceName = raceUrl.pathname.slice(1);

async function recreateDatabase() {
  const admin = new URL(raceUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${raceName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${raceName}"`);
  } finally {
    await client.end();
  }
  const prisma = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));
  execFileSync(prisma, ["migrate", "deploy"], { env: { ...process.env, DATABASE_URL: raceUrl.toString() }, stdio: "pipe" });
}

/** Anti-pattern for comparison: separate read, then an unconditional write (lost update). */
async function naiveReserve(client: PrismaClient, id: number, readsDone: Promise<void>, markRead: () => void) {
  const { amount } = await client.product.findUniqueOrThrow({ where: { id }, select: { amount: true } });
  markRead();
  await readsDone; // both attempts have read amount = 1 before either writes
  if (amount < 1) return false;
  await client.product.update({ where: { id }, data: { amount: amount - 1 } });
  return true;
}

async function main() {
  await recreateDatabase();
  // Two separate clients = two connection pools, like two server processes.
  const [a, b] = [createPrismaClient(raceUrl.toString()), createPrismaClient(raceUrl.toString())];
  try {
    const category = await a.category.create({ data: { code: "cpu", name: "Procesor" } });
    await a.product.create({
      data: {
        id: 1, code: "RACE000001", name: "Ostatnia sztuka", nameSortKey: "ostatnia sztuka", description: "",
        image: "/images/products/cpu.webp", price: 100, amount: 1, date: new Date(), categoryId: category.id,
      },
    });

    let atomicOk = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      await a.product.update({ where: { id: 1 }, data: { amount: 1 } });
      const results = await Promise.all([reserveStock(a, 1, 1), reserveStock(b, 1, 1)]);
      const { amount } = await a.product.findUniqueOrThrow({ where: { id: 1 } });
      if (results.filter(Boolean).length === 1 && amount === 0) atomicOk += 1;
      else console.log(`  round ${round}: ${JSON.stringify(results)}, amount ${amount}  ← unexpected`);
    }
    console.log(`Atomic conditional UPDATE: exactly one success and amount 0 in ${atomicOk}/${ROUNDS} rounds.`);

    await a.product.update({ where: { id: 1 }, data: { amount: 1 } });
    let reads = 0;
    let release!: () => void;
    const readsDone = new Promise<void>((resolve) => (release = resolve));
    const markRead = () => (++reads === 2 ? release() : undefined);
    const naive = await Promise.all([naiveReserve(a, 1, readsDone, markRead), naiveReserve(b, 1, readsDone, markRead)]);
    const { amount } = await a.product.findUniqueOrThrow({ where: { id: 1 } });
    console.log(
      `Naive read-then-write: ${naive.filter(Boolean).length} successes for 1 unit, amount ${amount} — ` +
        "the last unit was sold twice (lost update).",
    );
    if (atomicOk !== ROUNDS) process.exitCode = 1;
  } finally {
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

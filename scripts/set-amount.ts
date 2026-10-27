// Local, controlled change of one product's stock (Lab 08 persistence check).
//   npm run db:set-amount -- <id> <amount>
//   npm run db:set-amount -- <id> <amount> --skip-validation   (shows the database CHECK rejecting it)
// Not part of the app: no public form or API changes stock without authorization.
import { config } from "dotenv";
import { createPrismaClient } from "@/lib/prisma-client";
import { parseProductId } from "@/lib/products/product-id";
import { setProductAmount } from "@/lib/products/stock";

config({ quiet: true });

const args = process.argv.slice(2);
const skipValidation = args.includes("--skip-validation");
const [rawId, rawAmount] = args.filter((arg) => !arg.startsWith("--"));

const id = rawId === undefined ? null : parseProductId(rawId);
const amount = rawAmount !== undefined && /^-?[0-9]+$/.test(rawAmount) ? Number(rawAmount) : Number.NaN;

if (id === null || Number.isNaN(amount)) {
  console.error("Usage: npm run db:set-amount -- <id> <amount> [--skip-validation]");
  process.exit(2);
}

const client = createPrismaClient(process.env.DATABASE_URL);

try {
  if (skipValidation) {
    // Bypasses the app validation on purpose: the database constraints still apply.
    const { count } = await client.product.updateMany({ where: { id }, data: { amount } });
    console.log(`Changed rows: ${count} (validation skipped).`);
  } else {
    const result = await setProductAmount(client, id, amount);
    console.log(`Product ${result.id}: amount ${result.before} → ${result.after}.`);
  }
} catch (error) {
  const message = error instanceof Error ? (/Message: `([^`]+)`/.exec(error.message)?.[1] ?? error.message) : String(error);
  console.error(`Stock update rejected: ${message}`);
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}

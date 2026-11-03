// Local, controlled linking of demo orders to a real auth account (extension "Historia użytkownika").
//   npm run db:link-orders -- <a|b> <email of a user who signed in with GitHub>
// "a" = demo-user (ZAM-2026-0001…0004), "b" = demo-user-b (ZAM-2026-0005…0006).
// Not part of the app: no public form or API moves orders between users.
import { config } from "dotenv";
import { LinkOrdersError, linkDemoOrders } from "@/lib/orders/link-demo";
import { createPrismaClient } from "@/lib/prisma-client";
import { DEMO_USER, DEMO_USER_B } from "@/prisma/seed-demo";

config({ quiet: true });

const FIXTURES: Record<string, string> = { a: DEMO_USER.id, b: DEMO_USER_B.id };
const [fixture, email] = process.argv.slice(2);

if (fixture === undefined || !(fixture in FIXTURES) || !email) {
  console.error("Usage: npm run db:link-orders -- <a|b> <email>");
  process.exit(2);
}

const client = createPrismaClient(process.env.DATABASE_URL);

try {
  const moved = await linkDemoOrders(client, FIXTURES[fixture], email);
  console.log(moved.length > 0 ? `Linked to ${email}: ${moved.join(", ")}.` : "No orders left on this fixture user.");
} catch (error) {
  console.error(error instanceof LinkOrdersError ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}

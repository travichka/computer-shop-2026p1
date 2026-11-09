// Seed entry point: `npx --no-install prisma db seed` (configured in prisma.config.ts).
// Runs outside the app, so it creates its own client and never imports server-only modules.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { createPrismaClient } from "@/lib/prisma-client";
import { seedCatalog } from "./seed-catalog";
import { DEMO_USERS, seedDemoData } from "./seed-demo";
import { shouldSeedDemo } from "./seed-options";

config({ quiet: true });

const client = createPrismaClient(process.env.DATABASE_URL);

try {
  const data: unknown = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));
  const catalog = await seedCatalog(client, data);
  console.log(`Seed OK: ${catalog.categories} categories, ${catalog.products} products.`);
  if (shouldSeedDemo(process.env.DATABASE_URL!)) {
    const demo = await seedDemoData(client);
    console.log(
      `Demo data OK: users ${DEMO_USERS.map((user) => user.email).join(", ")}, ${demo.cartItems} cart items, ` +
        `${demo.orders} orders (${demo.ordersCreated} created now, existing history kept).`,
    );
  } else {
    // Production/shared database: catalog only; accounts, sessions and carts are never touched.
    console.log("Demo accounts/orders skipped (remote database; set SEED_DEMO=true to add them).");
  }
} catch (error) {
  console.error("Seed failed — no partial catalog was written:", error);
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}

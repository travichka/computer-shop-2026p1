// Seed entry point: `npx --no-install prisma db seed` (configured in prisma.config.ts).
// Runs outside the app, so it creates its own client and never imports server-only modules.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { createPrismaClient } from "@/lib/prisma-client";
import { seedCatalog } from "./seed-catalog";
import { DEMO_USER, seedDemoData } from "./seed-demo";

config({ quiet: true });

const client = createPrismaClient(process.env.DATABASE_URL);

try {
  const data: unknown = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));
  const catalog = await seedCatalog(client, data);
  console.log(`Seed OK: ${catalog.categories} categories, ${catalog.products} products.`);
  const demo = await seedDemoData(client);
  console.log(
    `Demo data OK: user ${DEMO_USER.email}, ${demo.cartItems} cart items, ` +
      `${demo.orders} orders (${demo.ordersCreated} created now, existing history kept).`,
  );
} catch (error) {
  console.error("Seed failed — no partial catalog was written:", error);
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}

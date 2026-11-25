// Lab 10, extension "Odrębne środowisko testowe": a real browser writes a cart on the deployed
// STAGING app; the cart tables of staging change, those of Production do not.
//   STAGING_URL=https://… node --env-file=.env.vercel-staging --import tsx e2e/staging/isolation.mts
// Needs two git-ignored files: .env.vercel-staging (DATABASE_URL + BETTER_AUTH_SECRET of staging)
// and .env.vercel-production (DATABASE_URL, only read). The session is created by this process
// directly in the staging database with the staging secret; the app has no login bypass.
import { readFileSync } from "node:fs";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { chromium } from "@playwright/test";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { parse } from "dotenv";
import pg from "pg";
import { readAuthEnv, sharedAuthOptions } from "@/lib/auth-options";
import { createPrismaClient } from "@/lib/prisma-client";

const base = new URL(process.env.STAGING_URL ?? "").origin;
const stagingUrl = process.env.DATABASE_URL!;
const productionUrl = parse(readFileSync(".env.vercel-production")).DATABASE_URL;
if (new URL(stagingUrl).host === new URL(productionUrl).host) throw new Error("Staging and Production share one host.");
if (!base.includes("staging")) throw new Error(`Refusing to write through ${base}: not a staging address.`);

/** Row count and checksum of the cart tables; no personal data is printed. */
async function carts(url: string): Promise<string> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const parts: string[] = [];
    for (const table of ["Cart", "CartItem", "Product"]) {
      const { rows } = await client.query<{ n: string; md5: string }>(
        `SELECT count(*) AS n, left(md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')), 10) AS md5 FROM "${table}" t`,
      );
      parts.push(`${table}=${rows[0].n}:${rows[0].md5}`);
    }
    return parts.join(" ");
  } finally {
    await client.end();
  }
}

const db = createPrismaClient(stagingUrl);
const USER = { id: "staging-e2e-user", name: "Test staging", email: "staging-e2e@computer-shop.test" };
const browser = await chromium.launch();
try {
  const product = await db.product.findFirstOrThrow({ where: { amount: { gte: 10 } }, orderBy: { id: "asc" } });
  await db.user.upsert({ where: { id: USER.id }, create: { ...USER, emailVerified: true }, update: {} });
  await db.cartItem.deleteMany({ where: { cart: { userId: USER.id } } });

  const productionBefore = await carts(productionUrl);
  const stagingBefore = await carts(stagingUrl);

  const auth = betterAuth({
    ...sharedAuthOptions(
      readAuthEnv({
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: base,
        GITHUB_CLIENT_ID: "unused",
        GITHUB_CLIENT_SECRET: "unused",
      }),
    ),
    database: prismaAdapter(db, { provider: "postgresql" }),
    plugins: [testUtils()],
    telemetry: { enabled: false },
  });
  const ctx = await auth.$context;
  const cookies = await ctx.test.getCookies({ userId: USER.id, domain: new URL(base).hostname });

  const context = await browser.newContext({ baseURL: base });
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto(`/product-list/${product.id}`);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await page.getByText("w koszyku 1 szt.").waitFor();
  await page.goto("/basket");
  await page.getByLabel(`Ilość: ${product.name}`).fill("3");
  await page.getByRole("button", { name: "Zmień" }).click();
  await page.getByText("Razem (3 szt.)").waitFor();
  const stagingAfter = await carts(stagingUrl);
  const productionDuring = await carts(productionUrl);

  // The staging session cookie must mean nothing on Production (other secret, other database).
  const production = await fetch("https://computer-shop-2026p1.vercel.app/api/auth/get-session", {
    headers: { cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
  });
  const foreignSession = (await production.text()).trim();

  await page.getByRole("button", { name: `Usuń z koszyka: ${product.name}` }).click();
  await page.getByText("Twój koszyk jest pusty.").waitFor();
  const left = await db.cartItem.count({ where: { cart: { userId: USER.id } } });
  const productionAfter = await carts(productionUrl);

  console.log(`staging    before: ${stagingBefore}\nstaging    after add+change: ${stagingAfter}`);
  console.log(`production before: ${productionBefore}\nproduction during: ${productionDuring}\nproduction after:  ${productionAfter}`);
  console.log(`staging cookie on Production → session: ${foreignSession}; rows left on staging after remove: ${left}`);
  const ok =
    stagingBefore !== stagingAfter &&
    productionBefore === productionDuring &&
    productionBefore === productionAfter &&
    foreignSession === "null" &&
    left === 0;
  console.log(ok ? "ISOLATION VERIFIED" : "ISOLATION FAILED");
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
  await db.session.deleteMany({ where: { userId: USER.id } });
  await db.$disconnect();
}

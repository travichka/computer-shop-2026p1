import { formatPrice } from "@/lib/format";
import { expect, test, type E2EUser } from "./fixtures";

// Cart in a real browser against the built app: add, change quantity, remove, refusal without a
// session, sign-out and isolation of two users. Every write is also checked in the database.

const USER_A: E2EUser = { id: "e2e-user-a", name: "Użytkownik E2E A", email: "e2e-a@computer-shop.test" };
const USER_B: E2EUser = { id: "e2e-user-b", name: "Użytkownik E2E B", email: "e2e-b@computer-shop.test" };

test.beforeEach(async ({ db }) => {
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.session.deleteMany();
});

async function availableProduct(db: import("@/lib/generated/prisma/client").PrismaClient, skip = 0) {
  return db.product.findFirstOrThrow({ where: { amount: { gte: 10 } }, orderBy: { id: "asc" }, skip });
}

async function cartRows(db: import("@/lib/generated/prisma/client").PrismaClient, userId: string) {
  return db.cartItem.findMany({ where: { cart: { userId } }, select: { id: true, productId: true, quantity: true } });
}

test("without a session the basket asks to sign in and the server refuses to add", async ({ page, db }) => {
  const product = await availableProduct(db);
  await page.goto("/basket");
  await expect(page.getByText("Koszyk jest dostępny po zalogowaniu.")).toBeVisible();

  await page.goto(`/product-list/${product.id}`);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Zaloguj się, aby zmieniać koszyk." })).toBeVisible();
  expect(await db.cartItem.count()).toBe(0);
});

test("signed-in user adds, changes quantity and removes; totals come from the server", async ({ page, context, db, signIn }) => {
  const product = await availableProduct(db);
  await signIn(context, USER_A);

  // New user: empty cart, total zero, no cart row needed.
  await page.goto("/basket");
  await expect(page.getByText("Twój koszyk jest pusty.")).toBeVisible();
  await expect(page.getByText(`Suma: ${formatPrice(0)}`)).toBeVisible();

  // Add twice → one line with quantity 2.
  await page.goto(`/product-list/${product.id}`);
  const add = page.getByRole("button", { name: "Dodaj do koszyka" });
  await add.click();
  await expect(page.getByRole("status")).toContainText("w koszyku 1 szt.");
  await add.click();
  await expect(page.getByRole("status")).toContainText("w koszyku 2 szt.");
  expect(await cartRows(db, USER_A.id)).toEqual([expect.objectContaining({ productId: product.id, quantity: 2 })]);

  await page.goto("/basket");
  await expect(page.getByRole("link", { name: product.name })).toBeVisible();
  await expect(page.getByText(`Razem (2 szt.): ${formatPrice(product.price * 2)}`)).toBeVisible();

  // Change quantity to 3.
  const quantity = page.getByLabel(`Ilość: ${product.name}`);
  await quantity.fill("3");
  await page.getByRole("button", { name: "Zmień" }).click();
  await expect(page.getByText(`Razem (3 szt.): ${formatPrice(product.price * 3)}`)).toBeVisible();
  expect((await cartRows(db, USER_A.id))[0].quantity).toBe(3);

  // Invalid quantity: the browser limits are removed, the SERVER still refuses and keeps 3.
  await quantity.evaluate((input) => {
    input.removeAttribute("min");
    input.removeAttribute("max");
  });
  await quantity.fill("100");
  await page.getByRole("button", { name: "Zmień" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ilość musi być liczbą całkowitą od 1 do 99" })).toBeVisible();
  expect((await cartRows(db, USER_A.id))[0].quantity).toBe(3);

  // More than in stock → refused.
  await quantity.fill(String(Math.min(product.amount + 1, 99)));
  await page.getByRole("button", { name: "Zmień" }).click();
  if (product.amount + 1 <= 99) {
    await expect(page.getByRole("alert").filter({ hasText: "W magazynie nie ma tylu sztuk" })).toBeVisible();
    expect((await cartRows(db, USER_A.id))[0].quantity).toBe(3);
  }

  // Remove → empty cart, total zero.
  await page.getByRole("button", { name: `Usuń z koszyka: ${product.name}` }).click();
  await expect(page.getByText("Twój koszyk jest pusty.")).toBeVisible();
  expect(await cartRows(db, USER_A.id)).toEqual([]);
});

test("the cart survives a new session of the same user; sign-out ends the old one", async ({ page, context, db, signIn, browser }) => {
  const product = await availableProduct(db);
  await signIn(context, USER_A);
  await page.goto(`/product-list/${product.id}`);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(page.getByRole("status")).toContainText("w koszyku 1 szt.");
  const oldCookies = await context.cookies();

  // Sign out through the app's own endpoint (same origin).
  const signOut = await page.request.post("/api/auth/sign-out", { headers: { origin: new URL(page.url()).origin }, data: {} });
  expect(signOut.ok()).toBe(true);
  expect(await db.session.count({ where: { userId: USER_A.id } })).toBe(0);

  // The old cookie no longer authorizes reading or writing.
  const replay = await browser.newContext();
  await replay.addCookies(oldCookies);
  const replayPage = await replay.newPage();
  await replayPage.goto("/basket");
  await expect(replayPage.getByText("Koszyk jest dostępny po zalogowaniu.")).toBeVisible();
  await replay.close();

  // A new login restores the same cart.
  const again = await browser.newContext();
  await signIn(again, USER_A);
  const againPage = await again.newPage();
  await againPage.goto("/basket");
  await expect(againPage.getByRole("link", { name: product.name })).toBeVisible();
  await again.close();
});

test("user B neither sees nor changes A's line, even with A's item id in the form", async ({ browser, db, signIn }) => {
  const productA = await availableProduct(db, 0);
  const productB = await availableProduct(db, 1);

  const contextA = await browser.newContext();
  await signIn(contextA, USER_A);
  const pageA = await contextA.newPage();
  await pageA.goto(`/product-list/${productA.id}`);
  await pageA.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(pageA.getByRole("status")).toContainText("w koszyku 1 szt.");
  const [lineA] = await cartRows(db, USER_A.id);

  const contextB = await browser.newContext();
  await signIn(contextB, USER_B);
  const pageB = await contextB.newPage();
  await pageB.goto("/basket");
  await expect(pageB.getByText("Twój koszyk jest pusty.")).toBeVisible();
  await expect(pageB.getByText(productA.name)).toHaveCount(0);

  // B adds an own line, then swaps the hidden itemId for A's line and submits.
  await pageB.goto(`/product-list/${productB.id}`);
  await pageB.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(pageB.getByRole("status")).toContainText("w koszyku 1 szt.");
  await pageB.goto("/basket");
  await pageB.locator('input[name="itemId"]').first().evaluate((input, id) => ((input as HTMLInputElement).value = String(id)), lineA.id);
  await pageB.getByLabel(`Ilość: ${productB.name}`).fill("5");
  await pageB.getByRole("button", { name: "Zmień" }).click();
  await expect(pageB.getByRole("alert").filter({ hasText: "Nie znaleziono takiej pozycji w Twoim koszyku." })).toBeVisible();

  expect(await cartRows(db, USER_A.id)).toEqual([expect.objectContaining({ id: lineA.id, quantity: 1 })]);
  await contextA.close();
  await contextB.close();
});

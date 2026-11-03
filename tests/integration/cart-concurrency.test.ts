import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CartService } from "@/lib/cart/cart-service";
import { makeProduct } from "../fixtures";
import { insertProducts } from "./helpers";
import { cartServiceFor, createTestAuth, signIn, USER_A } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

// Parallel requests of ONE user: two sessions (e.g. two browser profiles) on two connection pools.
const client = createTestClient();
const other = createTestClient();
const auth = createTestAuth(client);
afterAll(() => Promise.all([client.$disconnect(), other.$disconnect()]));

let first: CartService;
let second: CartService;

beforeEach(async () => {
  await resetDatabase(client);
  await client.user.create({ data: USER_A });
  await insertProducts(client, [makeProduct({ id: 1, amount: 10 }), makeProduct({ id: 2, amount: 200 })]);
  first = cartServiceFor(auth, client, await signIn(auth, USER_A.id));
  second = cartServiceFor(createTestAuth(other), other, await signIn(auth, USER_A.id));
});

const lines = () => client.cartItem.findMany({ orderBy: { productId: "asc" } });
const setAmount = (id: number, amount: number) => client.product.update({ where: { id }, data: { amount } });
const successes = (results: { ok: boolean }[]) => results.filter((r) => r.ok).length;

describe("atomic addProduct (base requirement)", () => {
  it("two parallel first adds create one cart and one line with quantity 2", async () => {
    const results = await Promise.all([first.addProduct(1), second.addProduct(1)]);
    expect(successes(results)).toBe(2);
    expect(await client.cart.count()).toBe(1);
    expect((await lines()).map((l) => [l.productId, l.quantity])).toEqual([[1, 2]]);
  });

  it("with one free unit exactly one of two parallel adds succeeds", async () => {
    await setAmount(1, 1);
    const results = await Promise.all([first.addProduct(1), second.addProduct(1)]);
    expect(successes(results)).toBe(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: "insufficient_stock" });
    expect((await lines()).map((l) => l.quantity)).toEqual([1]);
  });

  it("with one place left below 99 exactly one of two parallel adds succeeds", async () => {
    await first.addProduct(2);
    await first.setQuantity((await lines())[0].id, 98);
    const results = await Promise.all([first.addProduct(2), second.addProduct(2)]);
    expect(successes(results)).toBe(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: "limit_reached" });
    expect((await lines()).map((l) => l.quantity)).toEqual([99]);
  });

  it("many parallel adds never exceed the stock and never duplicate the line", async () => {
    await setAmount(1, 5);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? first : second).addProduct(1)));
    expect(successes(results)).toBe(5);
    expect((await lines()).map((l) => l.quantity)).toEqual([5]);
  });

  it("parallel first adds of different products share one cart", async () => {
    await Promise.all([first.addProduct(1), second.addProduct(2)]);
    expect(await client.cart.count()).toBe(1);
    expect((await lines()).map((l) => l.productId)).toEqual([1, 2]);
  });
});

describe("SQL constraints without the validator", () => {
  let cartId: number;
  beforeEach(async () => {
    await first.addProduct(1);
    cartId = (await client.cart.findFirstOrThrow()).id;
  });

  it.each([0, 100, -1])("rejects quantity %s inserted with raw SQL", async (quantity) => {
    await expect(
      client.$executeRaw`INSERT INTO "CartItem" ("cartId", "productId", quantity) VALUES (${cartId}, 2, ${quantity})`,
    ).rejects.toThrow(/cart_item_quantity_range/);
  });

  it.each([0, 100])("rejects updating a line to %s with raw SQL", async (quantity) => {
    await expect(client.$executeRaw`UPDATE "CartItem" SET quantity = ${quantity}`).rejects.toThrow(
      /cart_item_quantity_range/,
    );
    expect((await lines()).map((l) => l.quantity)).toEqual([1]);
  });

  it("rejects a duplicate product in one cart and a second cart of the same user", async () => {
    await expect(
      client.$executeRaw`INSERT INTO "CartItem" ("cartId", "productId", quantity) VALUES (${cartId}, 1, 1)`,
    ).rejects.toThrow(/CartItem_cartId_productId_key|unique/i);
    await expect(client.$executeRaw`INSERT INTO "Cart" ("userId") VALUES (${USER_A.id})`).rejects.toThrow(
      /Cart_userId_key|unique/i,
    );
  });

  it("rejects a cart of a user that does not exist", async () => {
    await expect(client.$executeRaw`INSERT INTO "Cart" ("userId") VALUES ('no-such-user')`).rejects.toThrow(
      /Cart_userId_fkey|foreign key/i,
    );
  });
});

// Extension "Zapis współbieżny". Conflict policy: setQuantity writes an absolute value in one
// conditional UPDATE, so parallel changes are serialized by the row lock and the last committed
// one wins (no lost update, no read-modify-write). A removal is final: a later setQuantity finds no
// own row and returns item_not_found — it never brings the line back.
describe("extension: concurrent setQuantity and remove (two sessions of one user)", () => {
  let itemId: number;
  beforeEach(async () => {
    await first.addProduct(1);
    itemId = (await lines())[0].id;
  });

  it("setQuantity ‖ setQuantity: both succeed, one value wins, still one valid line", async () => {
    for (let round = 0; round < 10; round += 1) {
      const results = await Promise.all([first.setQuantity(itemId, 3), second.setQuantity(itemId, 7)]);
      expect(successes(results)).toBe(2);
      const rows = await lines();
      expect(rows).toHaveLength(1);
      expect([3, 7]).toContain(rows[0].quantity);
    }
  });

  it("setQuantity ‖ removeItem: the line ends up removed; set either ran before or reports item_not_found", async () => {
    for (let round = 0; round < 10; round += 1) {
      await first.addProduct(1);
      itemId = (await lines())[0].id;
      const [set, removed] = await Promise.all([first.setQuantity(itemId, 5), second.removeItem(itemId)]);
      expect(removed).toEqual({ ok: true });
      if (!set.ok) expect(set.error).toBe("item_not_found");
      expect(await lines()).toEqual([]);
    }
  });

  it("removeItem ‖ removeItem: exactly one removal succeeds", async () => {
    const results = await Promise.all([first.removeItem(itemId), second.removeItem(itemId)]);
    expect(successes(results)).toBe(1);
    expect(await lines()).toEqual([]);
  });
});

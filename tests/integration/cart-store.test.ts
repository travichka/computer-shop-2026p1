import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addOne, deleteItem, readCart, updateQuantity } from "@/lib/cart/cart-store";
import { makeProduct } from "../fixtures";
import { catalogSnapshot, insertProducts } from "./helpers";
import { USER_A, USER_B } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

// Data module with two fictional accounts. It trusts the userId it gets — where that id comes from
// (the session) is tested in cart-session.test.ts.
const client = createTestClient();
afterAll(() => client.$disconnect());

beforeEach(async () => {
  await resetDatabase(client);
  await client.user.createMany({ data: [USER_A, USER_B] });
  await insertProducts(client, [
    makeProduct({ id: 1, price: 12345, amount: 5 }),
    makeProduct({ id: 2, price: 999, amount: 0 }),
    makeProduct({ id: 3, price: 2147483647, amount: 200 }),
  ]);
});

const itemOf = async (userId: string, productId: number) =>
  client.cartItem.findFirstOrThrow({ where: { productId, cart: { userId } } });

describe("readCart", () => {
  it("gives an empty cart and total 0 when no cart row exists — and creates none", async () => {
    expect(await readCart(client, USER_A.id)).toEqual({ lines: [], total: BigInt(0), units: 0 });
    expect(await client.cart.count()).toBe(0);
  });

  it("computes unit prices and totals on the server from current product data (bigint)", async () => {
    await addOne(client, USER_A.id, 1);
    await addOne(client, USER_A.id, 1);
    await addOne(client, USER_A.id, 3);
    await client.product.update({ where: { id: 1 }, data: { price: 20000 } }); // a price change is visible at once

    const cart = await readCart(client, USER_A.id);
    expect(cart.lines.map((l) => [l.productId, l.unitPrice, l.quantity, l.lineTotal])).toEqual([
      [1, 20000, 2, BigInt(40000)],
      [3, 2147483647, 1, BigInt(2147483647)],
    ]);
    expect(cart.total).toBe(BigInt(40000) + BigInt(2147483647));
    expect(cart.units).toBe(3);
  });

  it("flags a line whose quantity exceeds the stock after the stock fell", async () => {
    await updateQuantity(client, USER_A.id, (await addOneAndGetItem(USER_A.id, 1)).id, 4);
    await client.product.update({ where: { id: 1 }, data: { amount: 2 } });
    const [line] = (await readCart(client, USER_A.id)).lines;
    expect(line).toMatchObject({ quantity: 4, stock: 2, maxQuantity: 2, exceedsStock: true });
  });
});

async function addOneAndGetItem(userId: string, productId: number) {
  expect(await addOne(client, userId, productId)).toMatchObject({ ok: true });
  return itemOf(userId, productId);
}

describe("addOne", () => {
  it("creates the cart on the first write and increments the existing line without a duplicate", async () => {
    expect(await addOne(client, USER_A.id, 1)).toEqual({ ok: true, quantity: 1 });
    expect(await addOne(client, USER_A.id, 1)).toEqual({ ok: true, quantity: 2 });
    expect(await client.cart.count({ where: { userId: USER_A.id } })).toBe(1);
    expect(await client.cartItem.count()).toBe(1);
  });

  it("rejects an unknown or unavailable product and leaves no empty cart behind", async () => {
    expect(await addOne(client, USER_A.id, 999)).toEqual({ ok: false, error: "product_not_found" });
    expect(await addOne(client, USER_A.id, 2)).toEqual({ ok: false, error: "out_of_stock" });
    expect(await client.cart.count()).toBe(0);
  });

  it("never goes above the stock", async () => {
    for (let i = 0; i < 5; i += 1) await addOne(client, USER_A.id, 1);
    expect(await addOne(client, USER_A.id, 1)).toEqual({ ok: false, error: "insufficient_stock" });
    expect((await itemOf(USER_A.id, 1)).quantity).toBe(5);
  });

  it("never goes above 99 even with more stock", async () => {
    const item = await addOneAndGetItem(USER_A.id, 3);
    await updateQuantity(client, USER_A.id, item.id, 99);
    expect(await addOne(client, USER_A.id, 3)).toEqual({ ok: false, error: "limit_reached" });
    expect((await itemOf(USER_A.id, 3)).quantity).toBe(99);
  });

  it("does not change the stock (the cart reserves nothing)", async () => {
    const before = await catalogSnapshot(client);
    await addOne(client, USER_A.id, 1);
    expect(await catalogSnapshot(client)).toEqual(before);
  });
});

describe("updateQuantity / deleteItem — owner A and data of B", () => {
  it("changes and deletes only an own line", async () => {
    const item = await addOneAndGetItem(USER_A.id, 1);
    expect(await updateQuantity(client, USER_A.id, item.id, 3)).toEqual({ ok: true, quantity: 3 });
    expect(await deleteItem(client, USER_A.id, item.id)).toEqual({ ok: true });
    expect(await client.cartItem.count()).toBe(0);
    expect(await client.cart.count()).toBe(1); // the (now empty) cart itself stays
  });

  it("refuses more than the current stock", async () => {
    const item = await addOneAndGetItem(USER_A.id, 1);
    expect(await updateQuantity(client, USER_A.id, item.id, 6)).toEqual({ ok: false, error: "insufficient_stock" });
    expect((await itemOf(USER_A.id, 1)).quantity).toBe(1);
  });

  it("lets a stale line be reduced to the current stock", async () => {
    const item = await addOneAndGetItem(USER_A.id, 1);
    await updateQuantity(client, USER_A.id, item.id, 5);
    await client.product.update({ where: { id: 1 }, data: { amount: 2 } });
    expect(await updateQuantity(client, USER_A.id, item.id, 3)).toMatchObject({ ok: false });
    expect(await updateQuantity(client, USER_A.id, item.id, 2)).toEqual({ ok: true, quantity: 2 });
  });

  it("gives A the same refusal for B's item as for a missing one, and B's cart stays unchanged", async () => {
    const itemOfB = await addOneAndGetItem(USER_B.id, 1);
    await addOne(client, USER_A.id, 3); // A has a cart too
    const before = await client.cartItem.findMany({ where: { cart: { userId: USER_B.id } } });

    expect(await updateQuantity(client, USER_A.id, itemOfB.id, 4)).toEqual({ ok: false, error: "item_not_found" });
    expect(await deleteItem(client, USER_A.id, itemOfB.id)).toEqual({ ok: false, error: "item_not_found" });
    expect(await updateQuantity(client, USER_A.id, 999_999, 4)).toEqual({ ok: false, error: "item_not_found" });
    expect(await deleteItem(client, USER_A.id, 999_999)).toEqual({ ok: false, error: "item_not_found" });

    expect(await client.cartItem.findMany({ where: { cart: { userId: USER_B.id } } })).toEqual(before);
    expect((await readCart(client, USER_A.id)).lines.map((l) => l.productId)).toEqual([3]);
  });
});

describe("database rules behind the module", () => {
  it("blocks deleting a product that is in a cart (Restrict)", async () => {
    await addOne(client, USER_A.id, 1);
    await expect(client.product.delete({ where: { id: 1 } })).rejects.toThrow(/Foreign key|foreign key|violates/);
  });

  it("deletes the lines together with the cart", async () => {
    await addOne(client, USER_A.id, 1);
    await client.cart.delete({ where: { userId: USER_A.id } });
    expect(await client.cartItem.count()).toBe(0);
  });

  it("deletes the cart together with the user", async () => {
    await addOne(client, USER_A.id, 1);
    await client.user.delete({ where: { id: USER_A.id } });
    expect(await client.cart.count()).toBe(0);
  });
});

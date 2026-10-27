import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCatalog } from "@/prisma/seed-catalog";
import { buildOrderLines, DEMO_CART_ITEMS, DEMO_ORDERS, DEMO_USER, seedDemoData } from "@/prisma/seed-demo";
import { readCatalogJson } from "./helpers";
import { createTestClient, resetDatabase } from "./test-db";

const client = createTestClient();
afterAll(() => client.$disconnect());
beforeEach(async () => {
  await resetDatabase(client);
  await seedCatalog(client, readCatalogJson());
  await seedDemoData(client);
});

const cartId = async () => (await client.cart.findUniqueOrThrow({ where: { userId: DEMO_USER.id } })).id;

describe("extension: cart model", () => {
  it("seeds a Better Auth compatible user without a password and one cart", async () => {
    const user = await client.user.findUniqueOrThrow({ where: { id: DEMO_USER.id }, include: { cart: { include: { items: true } } } });
    expect(user).toMatchObject({ name: DEMO_USER.name, email: DEMO_USER.email, emailVerified: false, image: null });
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect(user.cart?.items).toHaveLength(DEMO_CART_ITEMS.length);
  });

  it("allows only one cart per user", async () => {
    await expect(client.cart.create({ data: { userId: DEMO_USER.id } })).rejects.toThrow(/Unique constraint/);
  });

  it("does not allow the same product twice in one cart", async () => {
    await expect(
      client.cartItem.create({ data: { cartId: await cartId(), productId: DEMO_CART_ITEMS[0].productId, quantity: 1 } }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it.each([0, 100, -1])("rejects quantity %s (CHECK 1..99)", async (quantity) => {
    await expect(client.cartItem.create({ data: { cartId: await cartId(), productId: 50, quantity } })).rejects.toThrow(
      /cart_item_quantity_range/,
    );
  });

  it("accepts the boundaries 1 and 99", async () => {
    const id = await cartId();
    await client.cartItem.create({ data: { cartId: id, productId: 50, quantity: 1 } });
    await client.cartItem.create({ data: { cartId: id, productId: 51, quantity: 99 } });
    expect(await client.cartItem.count({ where: { cartId: id } })).toBe(DEMO_CART_ITEMS.length + 2);
  });

  it("deletes the items together with the cart", async () => {
    const id = await cartId();
    await client.cart.delete({ where: { id } });
    expect(await client.cartItem.count({ where: { cartId: id } })).toBe(0);
  });

  it("rejects a second user with the same e-mail", async () => {
    await expect(
      client.user.create({ data: { id: "other", name: "Inny", email: DEMO_USER.email } }),
    ).rejects.toThrow(/Unique constraint/);
  });
});

describe("extension: order history", () => {
  it("seeds four deterministic orders with exact totals in grosze", async () => {
    const orders = await client.order.findMany({ orderBy: { number: "asc" }, include: { items: { orderBy: { id: "asc" } } } });
    expect(orders.map((o) => [o.number, o.status])).toEqual(DEMO_ORDERS.map((o) => [o.number, o.status]));
    for (const order of orders) {
      const sum = order.items.reduce((total, item) => total + item.lineTotal, BigInt(0));
      expect(order.total).toBe(sum);
      for (const item of order.items) expect(item.lineTotal).toBe(BigInt(item.unitPrice) * BigInt(item.quantity));
    }
  });

  it("keeps order values when the current product price changes (snapshot)", async () => {
    const before = await client.order.findUniqueOrThrow({ where: { number: "ZAM-2026-0001" }, include: { items: true } });
    await client.product.update({ where: { id: 13 }, data: { price: 1 } });
    await seedDemoData(client); // a second seed must not rewrite history either
    const after = await client.order.findUniqueOrThrow({ where: { number: "ZAM-2026-0001" }, include: { items: true } });
    expect(after).toEqual(before);
  });

  it("keeps the history when a product is deleted (SetNull + snapshot)", async () => {
    await client.cartItem.deleteMany({ where: { productId: 94 } });
    await client.product.delete({ where: { id: 94 } });
    const item = await client.orderItem.findFirstOrThrow({ where: { order: { number: "ZAM-2026-0003" }, productName: { not: "" } }, orderBy: { id: "asc" } });
    expect(item.productId).toBeNull();
    expect(item.productCode).toMatch(/^[A-Z0-9]{10}$/);
    expect(await client.order.count()).toBe(4);
  });

  it("blocks deleting a user who has orders", async () => {
    await expect(client.user.delete({ where: { id: DEMO_USER.id } })).rejects.toThrow(/Foreign key|foreign key|violates/);
  });

  it.each([
    ["quantity 0", { quantity: 0, unitPrice: 100, lineTotal: BigInt(0) }, /order_item_quantity_positive/],
    ["negative unit price", { quantity: 1, unitPrice: -1, lineTotal: BigInt(-1) }, /order_item_unit_price_nonnegative/],
    ["inconsistent line total", { quantity: 2, unitPrice: 100, lineTotal: BigInt(150) }, /order_item_line_total_consistent/],
  ])("rejects an order item with %s", async (_label, values, error) => {
    const order = await client.order.findUniqueOrThrow({ where: { number: "ZAM-2026-0002" } });
    await expect(
      client.orderItem.create({ data: { orderId: order.id, productCode: "AAAAAAAAAA", productName: "X", ...values } }),
    ).rejects.toThrow(error);
  });

  it("computes totals beyond int4 exactly", () => {
    const max = { id: 1, code: "MAXPRICE01", name: "Drogi", price: 2147483647 };
    const { total } = buildOrderLines([{ productId: 1, quantity: 99 }], new Map([[1, max]]));
    // 212 600 881 053 grosze — far beyond int4 (2 147 483 647), stored as int8.
    expect(total).toBe(BigInt("212600881053"));
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaProductRepository } from "@/lib/products/prisma-repository";
import { reserveStock, setProductAmount, StockUpdateError } from "@/lib/products/stock";
import { makeProduct } from "../fixtures";
import { insertProducts } from "./helpers";
import { createTestClient, resetDatabase } from "./test-db";

const client = createTestClient();
afterAll(() => client.$disconnect());
beforeEach(async () => {
  await resetDatabase(client);
  await insertProducts(client, [makeProduct({ id: 1, amount: 5 }), makeProduct({ id: 2, amount: 0 })]);
});

const amountOf = async (id: number) => (await client.product.findUniqueOrThrow({ where: { id } })).amount;

describe("setProductAmount", () => {
  it("changes exactly one product and the change is visible to a new connection", async () => {
    expect(await setProductAmount(client, 1, 0)).toEqual({ id: 1, before: 5, after: 0 });

    const other = createTestClient(); // separate pool — reads what is stored, not an in-memory copy
    try {
      const repository = createPrismaProductRepository(() => other);
      expect((await repository.getProductById(1))?.amount).toBe(0);
      expect((await repository.getProducts({ stock: "unavailable" })).map((p) => p.id)).toEqual([1, 2]);
    } finally {
      await other.$disconnect();
    }
  });

  it.each([-1, 1.5, 2147483648, Number.NaN])("rejects the amount %s and changes nothing", async (amount) => {
    await expect(setProductAmount(client, 1, amount)).rejects.toBeInstanceOf(StockUpdateError);
    expect(await amountOf(1)).toBe(5);
  });

  it("rejects an unknown or invalid id (not exactly one changed row)", async () => {
    await expect(setProductAmount(client, 999, 3)).rejects.toThrow(/exactly one/);
    await expect(setProductAmount(client, 0, 3)).rejects.toBeInstanceOf(StockUpdateError);
  });
});

describe("reserveStock (extension: concurrent write)", () => {
  it("lets exactly one of two concurrent attempts take the last unit", async () => {
    await client.product.update({ where: { id: 1 }, data: { amount: 1 } });
    const results = await Promise.all([reserveStock(client, 1, 1), reserveStock(client, 1, 1)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await amountOf(1)).toBe(0);
  });

  it("never oversells under many concurrent attempts from separate connections", async () => {
    await client.product.update({ where: { id: 1 }, data: { amount: 3 } });
    const clients = Array.from({ length: 4 }, () => createTestClient());
    try {
      const attempts = Array.from({ length: 12 }, (_, i) => reserveStock(clients[i % clients.length], 1, 1));
      const results = await Promise.all(attempts);
      expect(results.filter(Boolean)).toHaveLength(3);
      expect(await amountOf(1)).toBe(0);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });

  it("refuses a quantity larger than the stock without changing it", async () => {
    expect(await reserveStock(client, 1, 6)).toBe(false);
    expect(await amountOf(1)).toBe(5);
    expect(await reserveStock(client, 1, 5)).toBe(true);
    expect(await amountOf(1)).toBe(0);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/lib/prisma-client";
import { createProductRepository } from "@/lib/products/create-repository";
import { createPrismaProductRepository } from "@/lib/products/prisma-repository";
import { PRODUCT_SORTS, PRODUCT_TYPES, STOCK_FILTERS, type ProductCriteria } from "@/lib/products/types";
import { seedCatalog } from "@/prisma/seed-catalog";
import { makeProduct, NAME_FIXTURE, NAME_FIXTURE_EXPECTED_IDS } from "../fixtures";
import { catalogProducts, insertProducts, readCatalogJson } from "./helpers";
import { createTestClient, resetDatabase } from "./test-db";

const client = createTestClient();
const database = createPrismaProductRepository(() => client);
afterAll(() => client.$disconnect());
beforeEach(() => resetDatabase(client));

const ids = (products: { id: number }[]) => products.map((product) => product.id);

describe("Prisma adapter vs in-memory adapter (Lab 06) on the full data set", () => {
  const memory = createProductRepository(async () => catalogProducts());
  const combinations: ProductCriteria[] = [undefined, ...PRODUCT_TYPES].flatMap((type) =>
    STOCK_FILTERS.flatMap((stock) => PRODUCT_SORTS.map((sort) => ({ type, stock, sort }))),
  );

  it.each(combinations)("same products in the same order for %j", async (criteria) => {
    await seedCatalog(client, readCatalogJson());
    const fromDatabase = await database.getProducts(criteria);
    expect(fromDatabase).toEqual(await memory.getProducts(criteria));
  });
});

describe("Prisma adapter — ordering", () => {
  it("orders the Lab 06 name fixture by UTF-8 bytes of the key (COLLATE \"C\"), ties by id", async () => {
    const fixture = NAME_FIXTURE.map(({ id, name }) => makeProduct({ id, name }));
    await insertProducts(client, fixture);
    const memory = createProductRepository(async () => fixture);

    const fromDatabase = await database.getProducts({ sort: "name" });
    expect(ids(fromDatabase)).toEqual(NAME_FIXTURE_EXPECTED_IDS);
    expect(ids(fromDatabase)).toEqual(ids(await memory.getProducts({ sort: "name" })));
    // The original spelling is kept for display (both Unicode forms of "Ą": U+0104 and A + U+0328).
    for (const { id, name } of NAME_FIXTURE) expect(fromDatabase.find((p) => p.id === id)?.name).toBe(name);
    expect(fromDatabase.find((p) => p.id === 8)?.name).toBe("Ą");
    expect(fromDatabase.find((p) => p.id === 7)?.name).toBe("Ą");
  });

  it("does not depend on the database default collation", async () => {
    const fixture = NAME_FIXTURE.map(({ id, name }) => makeProduct({ id, name }));
    await insertProducts(client, fixture);
    // Locale-aware ordering of the original names would differ (e.g. "Łącznik" before "Zeta").
    const byLocale = await client.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Product" ORDER BY name COLLATE "pl-PL-x-icu", id`;
    const byKey = await client.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Product" ORDER BY "nameSortKey", id`;
    expect(ids(byKey)).toEqual(NAME_FIXTURE_EXPECTED_IDS);
    expect(ids(byLocale)).not.toEqual(NAME_FIXTURE_EXPECTED_IDS);
  });

  it("orders newest by real time descending, ties by id ascending", async () => {
    await insertProducts(client, [
      makeProduct({ id: 4, date: "2026-03-01T00:00:00.000Z" }),
      makeProduct({ id: 2, date: "2026-05-01T00:00:00.001Z" }),
      makeProduct({ id: 3, date: "2026-03-01T00:00:00.000Z" }),
      makeProduct({ id: 1, date: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(ids(await database.getProducts({ sort: "newest" }))).toEqual([2, 1, 3, 4]);
  });
});

describe("Prisma adapter — contract", () => {
  it("combines category, stock and sort in the query", async () => {
    await insertProducts(client, [
      makeProduct({ id: 11, type: "gpu", amount: 2, date: "2026-01-01T00:00:00.000Z" }),
      makeProduct({ id: 12, type: "gpu", amount: 0, date: "2026-09-01T00:00:00.000Z" }),
      makeProduct({ id: 13, type: "gpu", amount: 5, date: "2026-06-01T00:00:00.000Z" }),
      makeProduct({ id: 14, type: "cpu", amount: 5, date: "2026-12-01T00:00:00.000Z" }),
    ]);
    expect(ids(await database.getProducts({ type: "gpu", stock: "available", sort: "newest" }))).toEqual([13, 11]);
    expect(ids(await database.getProducts({ type: "gpu", stock: "unavailable" }))).toEqual([12]);
  });

  it("returns [] for a valid query without results", async () => {
    await insertProducts(client, [makeProduct({ id: 1, type: "cpu" })]);
    expect(await database.getProducts({ type: "disk" })).toEqual([]);
    expect(await database.getProducts({ type: "cpu", stock: "unavailable" })).toEqual([]);
  });

  it("returns the domain model: type from the category, integer grosze, ISO date with milliseconds", async () => {
    const product = makeProduct({ id: 7, type: "ram", price: 12345, amount: 0, date: "2026-10-01T10:00:00.123Z" });
    await insertProducts(client, [product]);
    expect(await database.getProductById(7)).toEqual(product);
  });

  it.each(["0001-01-01T00:00:00.000Z", "9999-12-31T23:59:59.999Z"])("keeps the boundary date %s", async (date) => {
    await insertProducts(client, [makeProduct({ id: 1, date })]);
    expect((await database.getProductById(1))?.date).toBe(date);
  });

  it("returns null for an unknown id", async () => {
    await insertProducts(client, [makeProduct({ id: 1 })]);
    expect(await database.getProductById(2)).toBeNull();
  });

  it.each([0, -1, 2147483648, Number.MAX_SAFE_INTEGER + 2, 1.5, Number.NaN])(
    "rejects id %s before any query",
    async (id) => {
      const noQueries = createPrismaProductRepository(() => {
        throw new Error("the database must not be queried");
      });
      expect(await noQueries.getProductById(id)).toBeNull();
    },
  );

  it("rejects the promise when the database is unreachable (no [] and no null)", async () => {
    const unreachable = createPrismaClient("postgresql://shop:wrong@127.0.0.1:1/shop_test");
    const broken = createPrismaProductRepository(() => unreachable);
    try {
      await expect(broken.getProducts({})).rejects.toThrow();
      await expect(broken.getProductById(1)).rejects.toThrow();
    } finally {
      await unreachable.$disconnect();
    }
  });
});

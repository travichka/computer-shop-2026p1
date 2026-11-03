import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProductValidationError } from "@/lib/products/validation";
import { seedCatalog } from "@/prisma/seed-catalog";
import { seedDemoData } from "@/prisma/seed-demo";
import { catalogSnapshot, readCatalogJson } from "./helpers";
import { createTestAuth, signIn, USER_A } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

const client = createTestClient();
afterAll(() => client.$disconnect());
beforeEach(() => resetDatabase(client));

describe("seedCatalog", () => {
  it("imports 4 categories and 100 products with ids, codes, prices, stock and dates", async () => {
    expect(await seedCatalog(client, readCatalogJson())).toEqual({ categories: 4, products: 100 });

    const json = readCatalogJson() as Array<Record<string, unknown>>;
    const rows = await client.product.findMany({ include: { category: true }, orderBy: { id: "asc" } });
    expect(rows).toHaveLength(100);
    expect(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.category.code,
        price: row.price,
        amount: row.amount,
        description: row.description,
        date: row.date.toISOString(),
        image: row.image,
      })),
    ).toEqual([...json].sort((a, b) => Number(a.id) - Number(b.id)));
    expect(await client.category.count()).toBe(4);
  });

  it("is repeatable: a second run gives the same catalog without duplicates", async () => {
    await seedCatalog(client, readCatalogJson());
    const first = await catalogSnapshot(client);
    await seedCatalog(client, readCatalogJson());
    const second = await catalogSnapshot(client);

    expect(second).toEqual(first);
    expect(second.categories).toHaveLength(4);
    expect(second.products).toHaveLength(100);
    expect(new Set(second.products.map((p) => p.code)).size).toBe(100);
  });

  it("restores changed demo values and leaves rows outside the file untouched", async () => {
    await seedCatalog(client, readCatalogJson());
    await client.product.update({ where: { id: 1 }, data: { amount: 999 } });
    const cpu = await client.category.findUniqueOrThrow({ where: { code: "cpu" } });
    await client.product.create({
      data: {
        id: 5000, code: "EXTRA00001", name: "Extra", nameSortKey: "extra", description: "", image: "/images/products/cpu.webp",
        price: 1, amount: 1, date: new Date(), categoryId: cpu.id,
      },
    });

    await seedCatalog(client, readCatalogJson());

    expect((await client.product.findUniqueOrThrow({ where: { id: 1 } })).amount).toBe(56);
    expect(await client.product.findUnique({ where: { id: 5000 } })).not.toBeNull();
    expect(await client.product.count()).toBe(101);
  });

  it("validates the whole file before writing anything", async () => {
    const data = readCatalogJson() as Array<Record<string, unknown>>;
    const broken = [...data, { ...data[0], code: "DUPLICATE1" }]; // duplicate id at the very end

    await expect(seedCatalog(client, broken)).rejects.toBeInstanceOf(ProductValidationError);
    expect(await client.category.count()).toBe(0);
    expect(await client.product.count()).toBe(0);
  });

  it("rolls the whole import back when a write fails in the middle", async () => {
    // Valid file, but product 50's code already belongs to another row in the database.
    const data = readCatalogJson() as Array<Record<string, unknown>>;
    const conflictingCode = String(data.find((p) => p.id === 50)!.code);
    const other = await client.category.create({ data: { code: "other", name: "Inna" } });
    await client.product.create({
      data: {
        id: 9000, code: conflictingCode, name: "Konflikt", nameSortKey: "konflikt", description: "",
        image: "/images/products/cpu.webp", price: 1, amount: 1, date: new Date(), categoryId: other.id,
      },
    });

    await expect(seedCatalog(client, data)).rejects.toThrow();

    // No category and no product from the file was kept — only the pre-existing row.
    expect((await client.category.findMany()).map((c) => c.code)).toEqual(["other"]);
    expect((await client.product.findMany()).map((p) => p.id)).toEqual([9000]);
  });
});

describe("seed and auth data (Lab 09)", () => {
  it("re-seeding keeps users, accounts, sessions and carts created by logging in", async () => {
    await seedCatalog(client, readCatalogJson());
    await seedDemoData(client);
    const auth = createTestAuth(client);
    await client.user.create({ data: USER_A });
    await client.account.create({
      data: { id: "acc-a", accountId: "12345", providerId: "github", userId: USER_A.id, updatedAt: new Date() },
    });
    await signIn(auth, USER_A.id);
    await client.cart.create({ data: { userId: USER_A.id, items: { create: { productId: 5, quantity: 2 } } } });
    const before = {
      users: await client.user.findMany({ orderBy: { id: "asc" } }),
      sessions: await client.session.findMany(),
      accounts: await client.account.findMany(),
      items: await client.cartItem.findMany({ where: { cart: { userId: USER_A.id } } }),
    };

    await seedCatalog(client, readCatalogJson());
    await seedDemoData(client);

    expect(await client.session.findMany()).toEqual(before.sessions);
    expect(await client.account.findMany()).toEqual(before.accounts);
    expect(await client.cartItem.findMany({ where: { cart: { userId: USER_A.id } } })).toEqual(before.items);
    expect((await client.user.findMany({ orderBy: { id: "asc" } })).map((u) => u.id)).toEqual(before.users.map((u) => u.id));
  });
});

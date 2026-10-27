import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeProduct } from "../fixtures";
import { insertProducts } from "./helpers";
import { createTestClient, resetDatabase } from "./test-db";

// Writes go through raw SQL on purpose: no Lab 06 validator, no Prisma type checks — only the
// database constraints from the migration history decide.
const client = createTestClient();
afterAll(() => client.$disconnect());

let cpuId: number;
beforeEach(async () => {
  await resetDatabase(client);
  await insertProducts(client, [makeProduct({ id: 1, code: "EXISTING01" })]);
  cpuId = (await client.category.findUniqueOrThrow({ where: { code: "cpu" } })).id;
});

interface RawProduct {
  id: number | string;
  code: string;
  name: string;
  price: number | string;
  amount: number | string;
  categoryId: number;
}

function insertRaw(overrides: Partial<RawProduct>) {
  const row: RawProduct = { id: 2, code: "VALIDCODE2", name: "Produkt", price: 100, amount: 1, categoryId: cpuId, ...overrides };
  return client.$executeRawUnsafe(
    `INSERT INTO "Product" (id, code, name, "nameSortKey", description, image, price, amount, date, "categoryId")
     VALUES ($1::text::int, $2, $3, lower($3), '', '/images/products/cpu.webp', $4::text::int, $5::text::int, now(), $6)`,
    String(row.id),
    row.code,
    row.name,
    String(row.price),
    String(row.amount),
    row.categoryId,
  );
}

describe("database constraints without the application validator", () => {
  it("accepts a valid row (control)", async () => {
    await expect(insertRaw({})).resolves.toBe(1);
  });

  it("rejects a negative price", async () => {
    await expect(insertRaw({ price: -1 })).rejects.toThrow(/product_price_nonnegative/);
  });

  it("rejects a negative amount", async () => {
    await expect(insertRaw({ amount: -1 })).rejects.toThrow(/product_amount_nonnegative/);
  });

  it("rejects a negative stock update of an existing product", async () => {
    await expect(client.$executeRaw`UPDATE "Product" SET amount = amount - 100 WHERE id = 1`).rejects.toThrow(
      /product_amount_nonnegative/,
    );
  });

  it.each(["price", "amount", "id"] as const)("rejects 2147483648 in %s (int4 range)", async (column) => {
    await expect(insertRaw({ [column]: "2147483648" })).rejects.toThrow(/out of range/);
  });

  it("rejects a non-positive id", async () => {
    await expect(insertRaw({ id: 0 })).rejects.toThrow(/product_id_positive/);
  });

  it("rejects a duplicate code", async () => {
    await expect(insertRaw({ code: "EXISTING01" })).rejects.toThrow(/Product_code_key|unique/i);
  });

  it("rejects a duplicate id", async () => {
    await expect(insertRaw({ id: 1 })).rejects.toThrow(/Product_pkey|unique/i);
  });

  it.each(["lowercase1", "SHORT", "TOOLONGCODE1", "ŁÓDŹ567890"])("rejects the code %j", async (code) => {
    await expect(insertRaw({ code })).rejects.toThrow(/product_code_format|too long/);
  });

  it.each(["", "   ", "\t\n"])("rejects the blank name %j", async (name) => {
    await expect(insertRaw({ name })).rejects.toThrow(/product_name_not_blank/);
  });

  it("rejects a product in a category that does not exist", async () => {
    await expect(insertRaw({ categoryId: 999 })).rejects.toThrow(/Product_categoryId_fkey|foreign key/i);
  });

  it("blocks deleting a category that still has products", async () => {
    await expect(client.$executeRaw`DELETE FROM "Category" WHERE code = 'cpu'`).rejects.toThrow(
      /Product_categoryId_fkey|foreign key/i,
    );
    expect(await client.category.count({ where: { code: "cpu" } })).toBe(1);
  });

  it("rejects the same violations through Prisma Client too", async () => {
    await expect(client.product.update({ where: { id: 1 }, data: { price: -5 } })).rejects.toThrow(
      /product_price_nonnegative/,
    );
    await expect(
      client.product.create({
        data: { ...makeProductRow(3), code: "EXISTING01", categoryId: cpuId },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });
});

function makeProductRow(id: number) {
  return {
    id,
    code: "PRISMA0003",
    name: "Prisma",
    nameSortKey: "prisma",
    description: "",
    image: "/images/products/cpu.webp",
    price: 1,
    amount: 1,
    date: new Date(),
  };
}

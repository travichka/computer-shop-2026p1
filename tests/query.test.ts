import { describe, expect, it } from "vitest";
import { createProductRepository } from "@/lib/products/create-repository";
import { nameSortKey, queryProducts } from "@/lib/products/query";
import type { Product } from "@/lib/products/types";
import { makeProduct, NAME_FIXTURE, NAME_FIXTURE_EXPECTED_IDS } from "./fixtures";

const ids = (products: Product[]) => products.map((product) => product.id);

describe("nameSortKey", () => {
  it("normalises Unicode and ignores letter case but keeps Polish letters", () => {
    expect(nameSortKey("ŁĄCZNIK")).toBe("łącznik");
    expect(nameSortKey("Ą")).toBe(nameSortKey("Ą"));
    expect(nameSortKey("Ą")).toBe("ą");
  });
});

describe("queryProducts — sort by name", () => {
  const fixture = NAME_FIXTURE.map(({ id, name }) => makeProduct({ id, name }));

  it("orders the compatibility fixture by UTF-8 key bytes, ties by id", () => {
    expect(ids(queryProducts(fixture, { sort: "name" }))).toEqual(NAME_FIXTURE_EXPECTED_IDS);
  });

  it("is the default sort", () => {
    expect(ids(queryProducts(fixture))).toEqual(NAME_FIXTURE_EXPECTED_IDS);
  });

  it("does not mutate the input array or its items", () => {
    const input = Object.freeze(fixture.map((product) => Object.freeze({ ...product })));
    const snapshot = JSON.stringify(input);
    const result = queryProducts(input, { sort: "name" });
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(result).not.toBe(input);
  });

  it("keeps the original name for display", () => {
    const [first] = queryProducts([makeProduct({ id: 1, name: "ŁĄCZNIK" })], { sort: "name" });
    expect(first.name).toBe("ŁĄCZNIK");
  });
});

describe("queryProducts — sort by newest", () => {
  const products = [
    makeProduct({ id: 4, date: "2025-01-01T00:00:00.000Z" }),
    makeProduct({ id: 3, date: "2026-10-01T10:00:00.000Z" }),
    makeProduct({ id: 1, date: "2024-05-05T12:00:00.000Z" }),
    makeProduct({ id: 2, date: "2026-10-01T10:00:00.000Z" }),
    makeProduct({ id: 5, date: "0001-01-01T00:00:00.000Z" }),
  ];

  it("orders by real time descending, ties by id ascending", () => {
    expect(ids(queryProducts(products, { sort: "newest" }))).toEqual([2, 3, 4, 1, 5]);
  });

  it("does not mutate the input", () => {
    const before = ids(products);
    queryProducts(products, { sort: "newest" });
    expect(ids(products)).toEqual(before);
  });
});

describe("queryProducts — filters", () => {
  const products = [
    makeProduct({ id: 1, type: "cpu", amount: 0 }),
    makeProduct({ id: 2, type: "gpu", amount: 3 }),
    makeProduct({ id: 3, type: "cpu", amount: 7 }),
    makeProduct({ id: 4, type: "ram", amount: 0 }),
  ];

  it("filters available products", () => {
    expect(ids(queryProducts(products, { stock: "available" }))).toEqual([2, 3]);
  });

  it("filters unavailable products", () => {
    expect(ids(queryProducts(products, { stock: "unavailable" }))).toEqual([1, 4]);
  });

  it("returns all products for stock=all", () => {
    expect(ids(queryProducts(products, { stock: "all" }))).toEqual([1, 2, 3, 4]);
  });

  it("filters by category and combines with stock", () => {
    expect(ids(queryProducts(products, { type: "cpu" }))).toEqual([1, 3]);
    expect(ids(queryProducts(products, { type: "cpu", stock: "available" }))).toEqual([3]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(queryProducts(products, { type: "disk" })).toEqual([]);
    expect(queryProducts([], {})).toEqual([]);
  });
});

describe("createProductRepository", () => {
  const products = [makeProduct({ id: 10 }), makeProduct({ id: 20, type: "gpu" })];
  const repository = createProductRepository(async () => products);

  it("returns a product by id", async () => {
    expect((await repository.getProductById(20))?.id).toBe(20);
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.getProductById(999)).toBeNull();
    expect(await repository.getProductById(Number.NaN)).toBeNull();
  });

  it("returns [] for a valid query without results", async () => {
    expect(await repository.getProducts({ type: "disk" })).toEqual([]);
  });

  it("rejects instead of hiding a source failure", async () => {
    const broken = createProductRepository(async () => {
      throw new Error("source down");
    });
    await expect(broken.getProducts({})).rejects.toThrow("source down");
    await expect(broken.getProductById(1)).rejects.toThrow("source down");
  });
});

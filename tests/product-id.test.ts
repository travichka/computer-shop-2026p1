import { describe, expect, it, vi } from "vitest";
import { createProductRepository } from "@/lib/products/create-repository";
import { findProductByRouteId, parseProductId } from "@/lib/products/product-id";
import type { ProductRepository } from "@/lib/products/types";
import { makeProduct } from "./fixtures";

describe("parseProductId", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    ["2147483647", 2147483647],
  ])("accepts %s", (raw, expected) => {
    expect(parseProductId(raw)).toBe(expected);
  });

  it.each([
    "abc",
    "12abc",
    "0",
    "-1",
    "+1",
    "01",
    "1.0",
    "1e3",
    " 1",
    "1 ",
    "",
    "2147483648",
    "9007199254740993",
    "99999999999999999999",
    "１２", // full-width digits
    "0x10",
  ])("rejects %j", (raw) => {
    expect(parseProductId(raw)).toBeNull();
  });
});

describe("findProductByRouteId", () => {
  const products = [makeProduct({ id: 7, amount: 0 }), makeProduct({ id: 8 })];
  const repository = createProductRepository(async () => products);

  it("returns an existing product, also one with zero stock", async () => {
    expect((await findProductByRouteId(repository, "7"))?.amount).toBe(0);
    expect((await findProductByRouteId(repository, "8"))?.id).toBe(8);
  });

  it("returns null for an unknown valid id", async () => {
    expect(await findProductByRouteId(repository, "9")).toBeNull();
  });

  it("does not query the repository for an invalid id", async () => {
    const spy: ProductRepository = { getProducts: vi.fn(), getProductById: vi.fn() };
    expect(await findProductByRouteId(spy, "12abc")).toBeNull();
    expect(spy.getProductById).not.toHaveBeenCalled();
  });

  it("keeps a repository failure as a rejection instead of null", async () => {
    const broken = createProductRepository(async () => {
      throw new Error("source down");
    });
    await expect(findProductByRouteId(broken, "7")).rejects.toThrow("source down");
  });
});

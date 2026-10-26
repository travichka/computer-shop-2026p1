import { describe, expect, it } from "vitest";
import { linkRelation } from "@/lib/nav";
import { createProductRepository } from "@/lib/products/create-repository";
import { parseCatalogSlug } from "@/lib/products/catalog-slug";
import { getFeaturedProducts } from "@/lib/products/featured";
import { makeProduct } from "./fixtures";

describe("linkRelation (active navigation section)", () => {
  it("marks the catalog link as the current page on /product-list", () => {
    expect(linkRelation("/product-list", "/product-list")).toBe("page");
  });

  it("marks the catalog section on a product page", () => {
    expect(linkRelation("/product-list", "/product-list/12")).toBe("section");
    expect(linkRelation("/product-list", "/product-list/12/image")).toBe("section");
  });

  it("stops at the segment boundary", () => {
    expect(linkRelation("/product-list", "/product-listing")).toBeNull();
    expect(linkRelation("/product-list", "/product-list-old/1")).toBeNull();
  });

  it("matches the home page exactly", () => {
    expect(linkRelation("/", "/")).toBe("page");
    expect(linkRelation("/", "/product-list")).toBeNull();
  });
});

describe("parseCatalogSlug", () => {
  it("handles /catalog without segments", () => {
    expect(parseCatalogSlug(undefined)).toEqual({ kind: "root" });
    expect(parseCatalogSlug([])).toEqual({ kind: "root" });
  });

  it("handles a category and a product in a category", () => {
    expect(parseCatalogSlug(["gpu"])).toEqual({ kind: "category", type: "gpu" });
    expect(parseCatalogSlug(["gpu", "12"])).toEqual({ kind: "product", type: "gpu", id: 12 });
  });

  it.each([[["psu"]], [["GPU"]], [["gpu", "01"]], [["gpu", "abc"]], [["gpu", "12", "x"]], [["12"]]])(
    "rejects %j",
    (slug) => {
      expect(parseCatalogSlug(slug)).toBeNull();
    },
  );
});

describe("getFeaturedProducts", () => {
  const products = [
    makeProduct({ id: 1, date: "2026-01-01T00:00:00.000Z" }),
    makeProduct({ id: 2, date: "2026-05-01T00:00:00.000Z", amount: 0 }),
    makeProduct({ id: 3, date: "2026-04-01T00:00:00.000Z" }),
    makeProduct({ id: 5, date: "2026-03-01T00:00:00.000Z" }),
    makeProduct({ id: 4, date: "2026-03-01T00:00:00.000Z" }),
  ];
  const repository = createProductRepository(async () => products);

  it("returns the three newest products in stock, date ties by id", async () => {
    expect((await getFeaturedProducts(repository)).map((product) => product.id)).toEqual([3, 4, 5]);
  });

  it("is deterministic and does not mutate the source", async () => {
    const before = products.map((product) => product.id);
    const first = await getFeaturedProducts(repository);
    const second = await getFeaturedProducts(repository);
    expect(second).toEqual(first);
    expect(products.map((product) => product.id)).toEqual(before);
  });
});

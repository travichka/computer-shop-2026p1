import { describe, expect, it } from "vitest";
import {
  catalogHref,
  DEFAULT_CATALOG_SETTINGS,
  parseCatalogSearchParams,
  type RawSearchParams,
} from "@/lib/products/catalog-params";

const parse = (raw: RawSearchParams) => parseCatalogSearchParams(raw);

describe("parseCatalogSearchParams", () => {
  it("accepts a valid combination of all three parameters", () => {
    expect(parse({ type: "gpu", stock: "available", sort: "newest" })).toEqual({
      settings: { type: "gpu", stock: "available", sort: "newest" },
      criteria: { type: "gpu", stock: "available", sort: "newest" },
      invalid: [],
    });
  });

  it("uses defaults for missing parameters without reporting an error", () => {
    expect(parse({})).toEqual({
      settings: DEFAULT_CATALOG_SETTINGS,
      criteria: { stock: "all", sort: "name" },
      invalid: [],
    });
  });

  it("maps type=all to no category restriction", () => {
    expect(parse({ type: "all" }).criteria).toEqual({ stock: "all", sort: "name" });
  });

  it("replaces an unknown value with the default and reports it, keeping the other settings", () => {
    const result = parse({ type: "psu", stock: "unavailable" });
    expect(result.settings).toEqual({ type: "all", stock: "unavailable", sort: "name" });
    expect(result.invalid).toEqual(["type"]);
  });

  it.each(["CPU", " cpu", "cpu ", "Gpu"])("treats %j as an unknown type (values are case-sensitive)", (type) => {
    expect(parse({ type }).invalid).toEqual(["type"]);
  });

  it("treats an empty value as invalid", () => {
    const result = parse({ type: "", stock: "", sort: "" });
    expect(result.settings).toEqual(DEFAULT_CATALOG_SETTINGS);
    expect(result.invalid).toEqual(["type", "stock", "sort"]);
  });

  it("treats a repeated key as invalid — example from the lab: ?type=gpu&type=cpu&sort=newest", () => {
    const result = parse({ type: ["gpu", "cpu"], sort: "newest" });
    expect(result.settings).toEqual({ type: "all", stock: "all", sort: "newest" });
    expect(result.criteria).toEqual({ stock: "all", sort: "newest" });
    expect(result.invalid).toEqual(["type"]);
  });

  it("treats a repeated key as invalid even when both values are equal", () => {
    expect(parse({ sort: ["name", "name"] }).invalid).toEqual(["sort"]);
  });

  it("ignores unknown parameter names", () => {
    expect(parse({ page: "2", q: ["a", "b"], type: "ram" })).toEqual({
      settings: { type: "ram", stock: "all", sort: "name" },
      criteria: { type: "ram", stock: "all", sort: "name" },
      invalid: [],
    });
  });

  it("does not mutate the input object", () => {
    const raw: RawSearchParams = { type: ["gpu", "cpu"], stock: "available" };
    const snapshot = structuredClone(raw);
    parse(raw);
    expect(raw).toEqual(snapshot);
  });
});

describe("catalogHref", () => {
  it("leaves out default values", () => {
    expect(catalogHref()).toBe("/product-list");
    expect(catalogHref(DEFAULT_CATALOG_SETTINGS)).toBe("/product-list");
  });

  it("keeps the parameter order of the contract", () => {
    expect(catalogHref({ sort: "newest", type: "gpu", stock: "available" })).toBe(
      "/product-list?type=gpu&stock=available&sort=newest",
    );
  });

  it("round-trips through the parser", () => {
    const settings = { type: "disk", stock: "unavailable", sort: "newest" } as const;
    const query = new URLSearchParams(catalogHref(settings).split("?")[1]);
    expect(parse(Object.fromEntries(query)).settings).toEqual(settings);
  });
});

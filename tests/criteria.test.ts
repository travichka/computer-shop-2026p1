import { describe, expect, it } from "vitest";
import { parseProductCriteria } from "@/lib/products/criteria";

const parse = (query: string) => parseProductCriteria(new URLSearchParams(query));

describe("parseProductCriteria", () => {
  it("accepts an empty query", () => {
    expect(parse("")).toEqual({ ok: true, criteria: {} });
  });

  it("accepts valid values", () => {
    expect(parse("type=gpu&stock=available&sort=newest")).toEqual({
      ok: true,
      criteria: { type: "gpu", stock: "available", sort: "newest" },
    });
  });

  it("accepts type=all as no category restriction", () => {
    expect(parse("type=all&sort=name")).toEqual({ ok: true, criteria: { sort: "name" } });
  });

  it.each(["type=psu", "stock=yes", "sort=price", "type=", "TYPE=cpu", "type=cpu&type=gpu", "type=CPU"])(
    "rejects %s",
    (query) => {
      expect(parse(query).ok).toBe(false);
    },
  );
});

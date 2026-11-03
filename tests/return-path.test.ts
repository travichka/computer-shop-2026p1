import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, returnPathForSection, safeReturnPath } from "@/lib/return-path";

describe("safeReturnPath", () => {
  it.each(["/", "/basket", "/order-history", "/product-list", "/catalog", "/account"])("keeps the known path %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/basket",
    "//evil.example",
    "/\\evil.example",
    "/basket?x=https://evil.example",
    "/basket/../admin",
    "javascript:alert(1)",
    "/BASKET",
    "",
    undefined,
    ["/basket"],
  ])("replaces %j with the default", (raw) => {
    expect(safeReturnPath(raw)).toBe(DEFAULT_RETURN_PATH);
  });
});

describe("returnPathForSection", () => {
  it.each([
    ["/product-list/12", "/product-list"],
    ["/catalog/gpu", "/catalog"],
    ["/basket", "/basket"],
    ["/login", "/"],
    ["/product-listing", "/"],
  ])("%s → %s", (pathname, expected) => {
    expect(returnPathForSection(pathname)).toBe(expected);
  });
});


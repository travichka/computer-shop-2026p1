import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidUtcDate, ProductValidationError, validateProducts } from "@/lib/products/validation";
import { PRODUCT_TYPES } from "@/lib/products/types";
import { makeProduct } from "./fixtures";

const valid = () => [makeProduct({ id: 1 }), makeProduct({ id: 2, type: "gpu" })];

function expectInvalid(data: unknown, fragment: string) {
  try {
    validateProducts(data);
  } catch (error) {
    expect(error).toBeInstanceOf(ProductValidationError);
    expect((error as ProductValidationError).issues.join("\n")).toContain(fragment);
    return;
  }
  throw new Error("expected validation to fail");
}

describe("validateProducts", () => {
  it("accepts valid products", () => {
    expect(validateProducts(valid())).toHaveLength(2);
  });

  it("accepts boundary values", () => {
    expect(() =>
      validateProducts([makeProduct({ id: 2147483647, price: 0, amount: 2147483647, date: "9999-12-31T23:59:59.999Z" })]),
    ).not.toThrow();
  });

  it("rejects a non-array root", () => {
    expectInvalid({ id: 1 }, "root");
  });

  it("rejects duplicate ids", () => {
    expectInvalid([makeProduct({ id: 1 }), makeProduct({ id: 1 })], "duplicate id");
  });

  it("rejects duplicate codes", () => {
    expectInvalid([makeProduct({ id: 1, code: "ABCDE12345" }), makeProduct({ id: 2, code: "ABCDE12345" })], "duplicate code");
  });

  it("rejects a negative price", () => {
    expectInvalid([makeProduct({ id: 1, price: -1 })], ".price");
  });

  it.each(["id", "price", "amount"] as const)("rejects 2147483648 in %s", (field) => {
    expectInvalid([makeProduct({ id: 1, [field]: 2147483648 })], `.${field}`);
  });

  it("rejects non-integer and unsafe numbers", () => {
    expectInvalid([makeProduct({ id: 1, price: 10.5 })], ".price");
    expectInvalid([makeProduct({ id: 1, amount: Number.MAX_SAFE_INTEGER + 1 })], ".amount");
    expectInvalid([{ ...makeProduct({ id: 1 }), id: "1" }], ".id");
    expectInvalid([makeProduct({ id: 0 })], ".id");
  });

  it.each([
    "2026-02-30T10:00:00.000Z", // day does not exist
    "2026-13-01T10:00:00.000Z", // month does not exist
    "2026-10-01T24:00:00.000Z", // hour out of range
    "2026-10-01T10:00:00Z", // missing milliseconds
    "2026-10-01T10:00:00.000+02:00", // not UTC
    "2026-10-01", // date only
    "0000-01-01T00:00:00.000Z", // year 0
    "October 1, 2026", // Date.parse accepts this
  ])("rejects an invalid date %s", (date) => {
    expectInvalid([makeProduct({ id: 1, date })], ".date");
  });

  it("rejects invalid codes", () => {
    expectInvalid([makeProduct({ id: 1, code: "abcde12345" })], ".code");
    expectInvalid([makeProduct({ id: 1, code: "ABC" })], ".code");
  });

  it("rejects blank names, U+0000 and lone surrogates", () => {
    expectInvalid([makeProduct({ id: 1, name: "   " })], ".name");
    expectInvalid([makeProduct({ id: 1, name: "a\u0000b" })], ".name");
    expectInvalid([makeProduct({ id: 1, name: "a\uD800b" })], ".name");
    expectInvalid([makeProduct({ id: 1, description: "x\u0000" })], ".description");
  });

  it("rejects unknown categories, external images and extra fields", () => {
    expectInvalid([{ ...makeProduct({ id: 1 }), type: "psu" }], ".type");
    expectInvalid([makeProduct({ id: 1, image: "https://example.com/cpu.webp" })], ".image");
    expectInvalid([{ ...makeProduct({ id: 1 }), extra: true }], "unexpected field");
  });

  it("returns new objects and leaves input untouched", () => {
    const input = valid();
    const snapshot = JSON.stringify(input);
    const output = validateProducts(input);
    expect(output[0]).not.toBe(input[0]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("isValidUtcDate", () => {
  it("accepts leap day and the year range edges", () => {
    expect(isValidUtcDate("2024-02-29T00:00:00.000Z")).toBe(true);
    expect(isValidUtcDate("0001-01-01T00:00:00.000Z")).toBe(true);
    expect(isValidUtcDate("9999-12-31T23:59:59.999Z")).toBe(true);
    expect(isValidUtcDate("2025-02-29T00:00:00.000Z")).toBe(false);
  });
});

describe("data/products.json", () => {
  const products = validateProducts(JSON.parse(readFileSync("data/products.json", "utf8")));

  it("contains 100 valid products", () => {
    expect(products).toHaveLength(100);
  });

  it("covers every category and has products out of stock", () => {
    for (const type of PRODUCT_TYPES) expect(products.some((p) => p.type === type)).toBe(true);
    expect(products.some((p) => p.amount === 0)).toBe(true);
  });

  it("has Polish letters, mixed case and duplicate names with different ids", () => {
    expect(products.some((p) => /[ąćęłńóśźż]/i.test(p.name.normalize("NFC")))).toBe(true);
    expect(products.some((p) => p.name === p.name.toUpperCase())).toBe(true);
    expect(products.some((p) => p.name === p.name.toLowerCase())).toBe(true);
    const names = products.map((p) => p.name);
    expect(new Set(names).size).toBeLessThan(names.length);
  });
});

import { describe, expect, it } from "vitest";
import { cartError, MAX_CART_QUANTITY } from "@/lib/cart/types";
import { parseCartItemId, parseCartProductId, parseCartQuantity } from "@/lib/cart/validation";

describe("parseCartQuantity", () => {
  it.each([
    [1, 1],
    ["1", 1],
    [42, 42],
    ["99", 99],
  ])("accepts %j", (raw, expected) => {
    expect(parseCartQuantity(raw)).toBe(expected);
  });

  it.each([
    0,
    "0",
    -1,
    "-1",
    100,
    "100",
    1.5,
    "1.5",
    "1e1",
    " 2",
    "2 ",
    "",
    "abc",
    "0x10",
    "05",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2 ** 53,
    null,
    undefined,
    true,
    [3],
    { quantity: 3 },
  ])("rejects %j", (raw) => {
    expect(parseCartQuantity(raw)).toBeNull();
  });

  it("uses the same limit as the SQL CHECK", () => {
    expect(MAX_CART_QUANTITY).toBe(99);
  });
});

describe("parseCartProductId / parseCartItemId", () => {
  it.each([
    [1, 1],
    ["7", 7],
    [2147483647, 2147483647],
    ["2147483647", 2147483647],
  ])("accepts %j", (raw, expected) => {
    expect(parseCartProductId(raw)).toBe(expected);
    expect(parseCartItemId(raw)).toBe(expected);
  });

  it.each([0, "0", -1, "01", 1.5, "1.0", 2147483648, "2147483648", 9007199254740993, "", "x", null, {}, ["1"]])(
    "rejects %j",
    (raw) => {
      expect(parseCartProductId(raw)).toBeNull();
      expect(parseCartItemId(raw)).toBeNull();
    },
  );
});

describe("cartError", () => {
  it("links validation errors to their form field", () => {
    expect(cartError("invalid_quantity")).toMatchObject({ ok: false, field: "quantity" });
    expect(cartError("invalid_item_id")).toMatchObject({ ok: false, field: "itemId" });
  });

  it("gives a foreign and a missing item the same answer", () => {
    expect(cartError("item_not_found")).not.toHaveProperty("field");
    expect(cartError("item_not_found").message).not.toMatch(/inn|cudz/i);
  });
});

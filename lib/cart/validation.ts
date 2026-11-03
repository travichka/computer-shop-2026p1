import { isProductIdInRange } from "@/lib/products/product-id";
import { MAX_CART_QUANTITY } from "./types";

// Server-side parsing of untrusted cart input (form fields or a hand-crafted action call).
// Accepts a safe integer or its plain decimal string; anything else (objects, "1.5", "1e2", "-1",
// " 3", "0x10", "01") is rejected. Returns null instead of throwing.

const DECIMAL = /^(0|[1-9][0-9]*)$/;

function toSafeInteger(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) ? raw : null;
  if (typeof raw !== "string" || !DECIMAL.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** Product id within the Lab 06 range 1..2147483647. */
export function parseCartProductId(raw: unknown): number | null {
  const id = toSafeInteger(raw);
  return id !== null && isProductIdInRange(id) ? id : null;
}

/** CartItem.id is a SERIAL int4 (1..2147483647) — the same range as product ids. */
export function parseCartItemId(raw: unknown): number | null {
  return parseCartProductId(raw);
}

/** Quantity 1..99. Zero is an error of setQuantity — removing is a separate operation. */
export function parseCartQuantity(raw: unknown): number | null {
  const quantity = toSafeInteger(raw);
  return quantity !== null && quantity >= 1 && quantity <= MAX_CART_QUANTITY ? quantity : null;
}

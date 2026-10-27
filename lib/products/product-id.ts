import type { Product, ProductRepository } from "./types";
import { MAX_INT32 } from "./validation";

// Decimal digits only, no sign, no leading zeros, no spaces: "12abc", "01", "-1", "1.0" fail.
const ID_PATTERN = /^[1-9][0-9]*$/;

/** Safe integer within the contract range 1..2147483647 (PostgreSQL int4, CHECK id > 0). */
export function isProductIdInRange(id: number): boolean {
  return Number.isSafeInteger(id) && id >= 1 && id <= MAX_INT32;
}

/**
 * Parses the raw [id] route segment. Checks the whole string first (parseInt would accept "12abc"),
 * then Number.isSafeInteger and the contract range 1..2147483647. Returns null for any invalid id.
 */
export function parseProductId(raw: string): number | null {
  if (!ID_PATTERN.test(raw)) return null;
  const id = Number(raw);
  return isProductIdInRange(id) ? id : null;
}

/**
 * Product for a raw route id: null when the id is invalid or unknown (→ notFound() in the page).
 * A repository failure is not caught here, so it stays a rejected promise (→ error.tsx).
 */
export async function findProductByRouteId(repository: ProductRepository, raw: string): Promise<Product | null> {
  const id = parseProductId(raw);
  if (id === null) return null;
  return repository.getProductById(id);
}

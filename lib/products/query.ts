import type { Product, ProductCriteria } from "./types";

/**
 * Shared name key: NFC → lower case → NFC. Polish letters stay in the key,
 * letter case does not influence the order. Stored as nameSortKey in Lab 08.
 */
export function nameSortKey(name: string): string {
  return name.normalize("NFC").toLowerCase().normalize("NFC");
}

/**
 * Filters and sorts products according to the criteria.
 * Never mutates the input array or its elements; always returns a new array.
 */
export function queryProducts(products: readonly Product[], criteria: ProductCriteria = {}): Product[] {
  const { type, stock = "all", sort = "name" } = criteria;

  const filtered = products.filter(
    (product) =>
      (type === undefined || product.type === type) &&
      (stock === "all" ||
        (stock === "available" && product.amount > 0) ||
        (stock === "unavailable" && product.amount === 0)),
  );

  if (sort === "newest") {
    const keyed = filtered.map((product) => ({ product, time: new Date(product.date).getTime() }));
    keyed.sort((a, b) => b.time - a.time || a.product.id - b.product.id);
    return keyed.map(({ product }) => product);
  }

  // Technical UTF-8 byte order (as COLLATE "C"), independent of system collation.
  // Each key is encoded once instead of on every comparison.
  const keyed = filtered.map((product) => ({ product, key: Buffer.from(nameSortKey(product.name), "utf8") }));
  keyed.sort((a, b) => Buffer.compare(a.key, b.key) || a.product.id - b.product.id);
  return keyed.map(({ product }) => product);
}

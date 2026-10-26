import { parseProductId } from "./product-id";
import { PRODUCT_TYPES, type ProductType } from "./types";

// Extension: /catalog/[[...slug]] — the path segments arrive as an array (or undefined for /catalog).
export type CatalogSlug =
  | { kind: "root" }
  | { kind: "category"; type: ProductType }
  | { kind: "product"; type: ProductType; id: number };

/**
 * /catalog → root, /catalog/gpu → category, /catalog/gpu/12 → product in category.
 * Unknown category, invalid id or more than two segments → null (the page calls notFound()).
 * Whether the product really belongs to the category is checked by the page after reading it.
 */
export function parseCatalogSlug(slug: string[] | undefined): CatalogSlug | null {
  if (slug === undefined || slug.length === 0) return { kind: "root" };
  if (slug.length > 2) return null;

  const [rawType, rawId] = slug;
  if (!(PRODUCT_TYPES as readonly string[]).includes(rawType)) return null;
  const type = rawType as ProductType;
  if (rawId === undefined) return { kind: "category", type };

  const id = parseProductId(rawId);
  return id === null ? null : { kind: "product", type, id };
}

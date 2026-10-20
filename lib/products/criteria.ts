import {
  PRODUCT_SORTS,
  PRODUCT_TYPES,
  STOCK_FILTERS,
  type ProductCriteria,
  type ProductSort,
  type ProductType,
  type StockFilter,
} from "./types";

export type CriteriaParseResult =
  | { ok: true; criteria: ProductCriteria }
  | { ok: false; errors: string[] };

const ALLOWED_PARAMS = ["type", "stock", "sort"] as const;

/**
 * Parses URL query parameters (type, stock, sort) into ProductCriteria.
 * Unknown parameters, repeated parameters and unknown values are errors.
 */
export function parseProductCriteria(params: URLSearchParams): CriteriaParseResult {
  const errors: string[] = [];
  const criteria: ProductCriteria = {};

  for (const key of new Set(params.keys())) {
    if (!(ALLOWED_PARAMS as readonly string[]).includes(key)) {
      errors.push(`Unknown parameter "${key}". Allowed: ${ALLOWED_PARAMS.join(", ")}.`);
    } else if (params.getAll(key).length > 1) {
      errors.push(`Parameter "${key}" may appear only once.`);
    }
  }

  const type = params.get("type");
  if (type !== null) {
    if ((PRODUCT_TYPES as readonly string[]).includes(type)) criteria.type = type as ProductType;
    else errors.push(`Invalid "type": expected one of ${PRODUCT_TYPES.join(", ")}.`);
  }

  const stock = params.get("stock");
  if (stock !== null) {
    if ((STOCK_FILTERS as readonly string[]).includes(stock)) criteria.stock = stock as StockFilter;
    else errors.push(`Invalid "stock": expected one of ${STOCK_FILTERS.join(", ")}.`);
  }

  const sort = params.get("sort");
  if (sort !== null) {
    if ((PRODUCT_SORTS as readonly string[]).includes(sort)) criteria.sort = sort as ProductSort;
    else errors.push(`Invalid "sort": expected one of ${PRODUCT_SORTS.join(", ")}.`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, criteria };
}

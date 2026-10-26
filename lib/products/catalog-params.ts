import {
  PRODUCT_SORTS,
  PRODUCT_TYPES,
  STOCK_FILTERS,
  type ProductCriteria,
  type ProductSort,
  type StockFilter,
} from "./types";

// Catalog URL contract (Lab 07): /product-list?type=…&stock=…&sort=…
// The URL is the only source of catalog state; this module turns it into settings for the
// controls and typed criteria for the repository. Pure functions, no React, no data access.

export const CATALOG_TYPES = ["all", ...PRODUCT_TYPES] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export interface CatalogSettings {
  type: CatalogType;
  stock: StockFilter;
  sort: ProductSort;
}

export type CatalogParam = keyof CatalogSettings;

export const DEFAULT_CATALOG_SETTINGS: Readonly<CatalogSettings> = Object.freeze({
  type: "all",
  stock: "all",
  sort: "name",
});

/** Shape of awaited `searchParams` in a page: plain object, not URLSearchParams. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CatalogParseResult {
  /** Values for the controls; invalid ones are replaced by defaults. */
  settings: CatalogSettings;
  /** Validated, typed criteria passed to the repository. */
  criteria: ProductCriteria;
  /** Recognised parameters whose value was ignored (unknown, empty or repeated). */
  invalid: CatalogParam[];
}

const ALLOWED: { [K in CatalogParam]: readonly CatalogSettings[K][] } = {
  type: CATALOG_TYPES,
  stock: STOCK_FILTERS,
  sort: PRODUCT_SORTS,
};

const PARAMS = Object.keys(ALLOWED) as CatalogParam[];

function pick<K extends CatalogParam>(
  key: K,
  raw: string | string[] | undefined,
  invalid: CatalogParam[],
): CatalogSettings[K] {
  if (raw === undefined) return DEFAULT_CATALOG_SETTINGS[key];
  // A repeated key (?type=gpu&type=cpu) arrives as an array; an empty value as "".
  if (typeof raw === "string" && (ALLOWED[key] as readonly string[]).includes(raw)) {
    return raw as CatalogSettings[K];
  }
  invalid.push(key);
  return DEFAULT_CATALOG_SETTINGS[key];
}

/**
 * Missing parameter → default. Unknown, empty or repeated value of a recognised parameter →
 * default plus an entry in `invalid`; the other valid settings are kept. Unknown names are ignored.
 */
export function parseCatalogSearchParams(raw: RawSearchParams): CatalogParseResult {
  const invalid: CatalogParam[] = [];
  const settings: CatalogSettings = {
    type: pick("type", raw.type, invalid),
    stock: pick("stock", raw.stock, invalid),
    sort: pick("sort", raw.sort, invalid),
  };
  return { settings, criteria: toCriteria(settings), invalid };
}

/** "all" categories means no category restriction in the repository. */
export function toCriteria(settings: CatalogSettings): ProductCriteria {
  return {
    ...(settings.type === "all" ? {} : { type: settings.type }),
    stock: settings.stock,
    sort: settings.sort,
  };
}

/** Catalog URL for the settings; default values are left out to keep links short. */
export function catalogHref(settings: Partial<CatalogSettings> = {}): string {
  const query = new URLSearchParams();
  for (const key of PARAMS) {
    const value = settings[key];
    if (value !== undefined && value !== DEFAULT_CATALOG_SETTINGS[key]) query.set(key, value);
  }
  const search = query.toString();
  return search ? `/product-list?${search}` : "/product-list";
}

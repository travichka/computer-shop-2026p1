import type { CatalogParam, CatalogType } from "./catalog-params";
import { PRODUCT_TYPE_LABELS, type ProductSort, type StockFilter } from "./types";

// Polish labels for the catalog controls and messages.
export const TYPE_LABELS: Record<CatalogType, string> = { all: "Wszystkie", ...PRODUCT_TYPE_LABELS };
export const STOCK_LABELS: Record<StockFilter, string> = {
  all: "Wszystkie",
  available: "Dostępne",
  unavailable: "Niedostępne",
};
export const SORT_LABELS: Record<ProductSort, string> = { name: "Nazwa (A–Z)", newest: "Najnowsze" };

/** Genitive form used in "Pominięto błędne ustawienie …". */
export const PARAM_LABELS: Record<CatalogParam, string> = {
  type: "kategorii",
  stock: "dostępności",
  sort: "sortowania",
};

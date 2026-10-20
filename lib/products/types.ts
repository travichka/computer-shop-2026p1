// Product contract shared by the repository, views and tests.
// This file holds only types and constants, so it is safe to import anywhere.

export const PRODUCT_TYPES = ["cpu", "gpu", "ram", "disk"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const STOCK_FILTERS = ["all", "available", "unavailable"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export const PRODUCT_SORTS = ["name", "newest"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface Product {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  /** Integer amount in grosze (1/100 PLN). */
  price: number;
  /** Units in stock. */
  amount: number;
  description: string;
  /** UTC timestamp, YYYY-MM-DDTHH:mm:ss.sssZ. */
  date: string;
  /** Local URL of an image served from public/. */
  image: string;
}

export interface ProductCriteria {
  /** Restrict to one category; omitted means all categories. */
  type?: ProductType;
  /** Defaults to "all". */
  stock?: StockFilter;
  /** Defaults to "name". */
  sort?: ProductSort;
}

export interface ProductRepository {
  getProducts(criteria: ProductCriteria): Promise<Product[]>;
  getProductById(id: number): Promise<Product | null>;
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  cpu: "Procesor",
  gpu: "Karta graficzna",
  ram: "Pamięć RAM",
  disk: "Dysk",
};

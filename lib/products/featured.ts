import type { Product, ProductRepository } from "./types";

export const FEATURED_COUNT = 3;

/**
 * Extension (parallel route @featured): the three newest products in stock.
 * Deterministic for a given data set — "newest" breaks date ties by id ascending.
 */
export async function getFeaturedProducts(repository: ProductRepository): Promise<Product[]> {
  const products = await repository.getProducts({ stock: "available", sort: "newest" });
  return products.slice(0, FEATURED_COUNT);
}

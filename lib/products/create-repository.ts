import { queryProducts } from "./query";
import type { Product, ProductRepository } from "./types";

/**
 * Builds a read-only repository on top of any async source of validated products.
 * The source decides where data comes from (JSON file now, database in Lab 08);
 * a failing source rejects the returned promises — failures are never turned into [] or null.
 */
export function createProductRepository(load: () => Promise<readonly Product[]>): ProductRepository {
  return {
    async getProducts(criteria) {
      return queryProducts(await load(), criteria);
    },
    async getProductById(id) {
      if (!Number.isSafeInteger(id)) return null;
      const products = await load();
      return products.find((product) => product.id === id) ?? null;
    },
  };
}

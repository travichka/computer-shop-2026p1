import "server-only";

import { getPrisma } from "@/lib/db";
import { createPrismaProductRepository } from "./prisma-repository";
import type { ProductRepository } from "./types";

// Lab 08: the shop reads PostgreSQL through Prisma. data/products.json is only the import source of
// the seed and of tests — there is no silent fallback to the file when the database is down.
const databaseRepository = createPrismaProductRepository(getPrisma);

// Optional artificial latency (ms) for the loading experiment, e.g. PRODUCT_REPOSITORY_DELAY_MS=1500.
const DELAY_MS = Math.max(0, Number(process.env.PRODUCT_REPOSITORY_DELAY_MS) || 0);
const delay = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

/** Server-side product repository used by pages, generateMetadata and the API route. */
export const productRepository: ProductRepository =
  DELAY_MS === 0
    ? databaseRepository
    : {
        getProducts: (criteria) => delay().then(() => databaseRepository.getProducts(criteria)),
        getProductById: (id) => delay().then(() => databaseRepository.getProductById(id)),
      };

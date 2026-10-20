import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createProductRepository } from "./create-repository";
import type { Product } from "./types";
import { validateProducts } from "./validation";

const DATA_FILE = path.join(process.cwd(), "data", "products.json");

// Optional artificial latency (ms) for the loading experiment, e.g. PRODUCT_REPOSITORY_DELAY_MS=1500.
const DELAY_MS = Math.max(0, Number(process.env.PRODUCT_REPOSITORY_DELAY_MS) || 0);

let cache: Promise<readonly Product[]> | null = null;

async function readProductsFile(): Promise<readonly Product[]> {
  const text = await readFile(DATA_FILE, "utf8");
  return validateProducts(JSON.parse(text));
}

function loadProducts(): Promise<readonly Product[]> {
  if (!cache) {
    const pending = readProductsFile();
    cache = pending;
    // Do not cache a failure: a later retry() reads the file again.
    pending.catch(() => {
      if (cache === pending) cache = null;
    });
  }
  if (DELAY_MS === 0) return cache;
  const data = cache;
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS)).then(() => data);
}

/** Server-side product repository backed by data/products.json (read-only). */
export const productRepository = createProductRepository(loadProducts);

import { readFileSync } from "node:fs";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Product } from "@/lib/products/types";
import { validateProducts } from "@/lib/products/validation";
import { CATEGORIES, productColumns } from "@/prisma/seed-catalog";

/** Raw JSON of the demo catalog (import source of the seed). */
export function readCatalogJson(): unknown {
  return JSON.parse(readFileSync(new URL("../../data/products.json", import.meta.url), "utf8"));
}

export function catalogProducts(): readonly Product[] {
  return validateProducts(readCatalogJson());
}

/** Inserts a controlled set of products (and the four categories) through the same column mapping as the seed. */
export async function insertProducts(client: PrismaClient, products: readonly Product[]): Promise<void> {
  const ids = new Map<string, number>();
  for (const category of CATEGORIES) {
    const row = await client.category.upsert({ where: { code: category.code }, create: category, update: {} });
    ids.set(category.code, row.id);
  }
  await client.product.createMany({
    data: products.map((product) => ({ id: product.id, ...productColumns(product, ids.get(product.type)!) })),
  });
}

/** Stable fingerprint of the whole catalog table, to compare before/after an operation. */
export async function catalogSnapshot(client: PrismaClient) {
  const products = await client.product.findMany({ orderBy: { id: "asc" }, include: { category: true } });
  return {
    categories: await client.category.findMany({ orderBy: { code: "asc" } }),
    products: products.map((p) => ({ ...p, date: p.date.toISOString() })),
  };
}

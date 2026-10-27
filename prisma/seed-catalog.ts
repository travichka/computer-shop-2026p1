import type { PrismaClient } from "@/lib/generated/prisma/client";
import { nameSortKey } from "@/lib/products/query";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES, type Product, type ProductType } from "@/lib/products/types";
import { validateProducts } from "@/lib/products/validation";

/** The four categories with stable codes; names are the Polish labels of the views. */
export const CATEGORIES = PRODUCT_TYPES.map((code) => ({ code, name: PRODUCT_TYPE_LABELS[code] }));

export interface CatalogSeedSummary {
  categories: number;
  products: number;
}

/** Columns written for one product; nameSortKey always comes from the shared Lab 06 function. */
export function productColumns(product: Product, categoryId: number) {
  return {
    code: product.code,
    name: product.name,
    nameSortKey: nameSortKey(product.name),
    description: product.description,
    image: product.image,
    price: product.price,
    amount: product.amount,
    date: new Date(product.date),
    categoryId,
  };
}

/**
 * Imports the demo catalog. The whole input is validated first (Lab 06 validator), so an invalid
 * file never starts writing. Then categories (by code) and products (by id) are upserted in one
 * transaction: a failing write rolls everything back. Running it twice gives the same catalog.
 * Updated demo data: the 4 categories and the products whose ids are in the file (all columns,
 * including amount). Other rows are left untouched; nothing is deleted.
 */
export async function seedCatalog(client: PrismaClient, data: unknown): Promise<CatalogSeedSummary> {
  const products = validateProducts(data);

  return client.$transaction(
    async (tx) => {
      const categoryIds = new Map<ProductType, number>();
      for (const category of CATEGORIES) {
        const row = await tx.category.upsert({
          where: { code: category.code },
          create: category,
          update: { name: category.name },
          select: { id: true },
        });
        categoryIds.set(category.code, row.id);
      }

      for (const product of products) {
        const columns = productColumns(product, categoryIds.get(product.type)!);
        await tx.product.upsert({
          where: { id: product.id },
          create: { id: product.id, ...columns },
          update: columns,
        });
      }

      return { categories: CATEGORIES.length, products: products.length };
    },
    { timeout: 60_000 },
  );
}

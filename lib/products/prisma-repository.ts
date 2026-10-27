import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { isProductIdInRange } from "./product-id";
import { PRODUCT_TYPES, type Product, type ProductCriteria, type ProductRepository, type ProductSort } from "./types";

// PostgreSQL adapter of ProductRepository (Lab 08). Same async contract as the in-memory adapter
// from Lab 06 (create-repository.ts): [] for no results, null for an unknown id, rejected promise
// on failure. Not server-only, so integration tests can use it with a test-database client.

const productSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  image: true,
  price: true,
  amount: true,
  date: true,
  category: { select: { code: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** Filters from validated criteria — evaluated by the database, not in memory. */
export function toProductWhere({ type, stock = "all" }: ProductCriteria): Prisma.ProductWhereInput {
  return {
    ...(type === undefined ? {} : { category: { code: type } }),
    ...(stock === "available" ? { amount: { gt: 0 } } : {}),
    ...(stock === "unavailable" ? { amount: 0 } : {}),
  };
}

/** Same order as Lab 06: name key (COLLATE "C" = UTF-8 bytes) or date descending; ties by id. */
export function toProductOrderBy(sort: ProductSort = "name"): Prisma.ProductOrderByWithRelationInput[] {
  return sort === "newest" ? [{ date: "desc" }, { id: "asc" }] : [{ nameSortKey: "asc" }, { id: "asc" }];
}

/** Database row → domain model of the views; nameSortKey and categoryId stay inside the repository. */
export function toProduct(row: ProductRow): Product {
  const type = row.category.code;
  if (!(PRODUCT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Product ${row.id} has an unknown category code "${type}".`);
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: type as Product["type"],
    price: row.price,
    amount: row.amount,
    description: row.description,
    date: row.date.toISOString(),
    image: row.image,
  };
}

/** `getClient` is called per query, so the shared client is created only when data is read. */
export function createPrismaProductRepository(getClient: () => PrismaClient): ProductRepository {
  return {
    async getProducts(criteria) {
      const rows = await getClient().product.findMany({
        where: toProductWhere(criteria),
        orderBy: toProductOrderBy(criteria.sort),
        select: productSelect,
      });
      return rows.map(toProduct);
    },
    async getProductById(id) {
      // Out-of-range ids never reach the ORM (int4 would make PostgreSQL raise an error).
      if (!isProductIdInRange(id)) return null;
      const row = await getClient().product.findUnique({ where: { id }, select: productSelect });
      return row === null ? null : toProduct(row);
    },
  };
}

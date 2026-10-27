import type { OrderStatus, PrismaClient } from "@/lib/generated/prisma/client";

// Demo data for the extensions "Model koszyka" and "Historia zamówień". Runs after the catalog seed.

/** Fictional account with every field Better Auth requires; no password (credentials come in Lab 09). */
export const DEMO_USER = {
  id: "demo-user",
  name: "Konto demonstracyjne",
  email: "demo@computer-shop.test",
  emailVerified: false,
  image: null,
} as const;

export const DEMO_CART_ITEMS = [
  { productId: 1, quantity: 1 },
  { productId: 18, quantity: 2 },
] as const;

interface DemoOrder {
  number: string;
  status: OrderStatus;
  placedAt: string;
  items: ReadonlyArray<{ productId: number; quantity: number }>;
}

/** Four deterministic orders (fixed numbers, dates, products and quantities). */
export const DEMO_ORDERS: readonly DemoOrder[] = [
  { number: "ZAM-2026-0001", status: "DELIVERED", placedAt: "2026-09-01T10:00:00.000Z", items: [{ productId: 13, quantity: 1 }, { productId: 30, quantity: 2 }] },
  { number: "ZAM-2026-0002", status: "SHIPPED", placedAt: "2026-09-15T12:30:00.000Z", items: [{ productId: 51, quantity: 1 }] },
  { number: "ZAM-2026-0003", status: "PAID", placedAt: "2026-10-01T08:15:00.000Z", items: [{ productId: 94, quantity: 1 }, { productId: 2, quantity: 1 }] },
  { number: "ZAM-2026-0004", status: "CANCELLED", placedAt: "2026-10-20T16:45:00.000Z", items: [{ productId: 77, quantity: 3 }] },
];

interface ProductSnapshotSource {
  id: number;
  code: string;
  name: string;
  price: number;
}

/**
 * Order lines with a snapshot of the product at purchase time and exact integer totals in grosze.
 * BigInt keeps unitPrice × quantity and the sum exact beyond 2^53 and beyond int4.
 */
export function buildOrderLines(
  items: DemoOrder["items"],
  products: ReadonlyMap<number, ProductSnapshotSource>,
) {
  const lines = items.map(({ productId, quantity }) => {
    const product = products.get(productId);
    if (!product) throw new Error(`Demo order refers to a missing product ${productId}.`);
    return {
      productId,
      productCode: product.code,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      lineTotal: BigInt(product.price) * BigInt(quantity),
    };
  });
  const total = lines.reduce((sum, line) => sum + line.lineTotal, BigInt(0));
  return { lines, total };
}

export interface DemoSeedSummary {
  cartItems: number;
  orders: number;
  ordersCreated: number;
}

/**
 * Upserts the demo user and cart (listed cart items get their quantity reset). Orders are created
 * only when their number does not exist yet: history is never rewritten, so a later price change
 * or a second seed does not touch existing snapshots. One transaction for all of it.
 */
export async function seedDemoData(client: PrismaClient): Promise<DemoSeedSummary> {
  return client.$transaction(
    async (tx) => {
      const { id: userId, ...profile } = DEMO_USER;
      await tx.user.upsert({ where: { id: userId }, create: DEMO_USER, update: profile });

      const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
      for (const item of DEMO_CART_ITEMS) {
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
          create: { cartId: cart.id, ...item },
          update: { quantity: item.quantity },
        });
      }

      let ordersCreated = 0;
      for (const order of DEMO_ORDERS) {
        if (await tx.order.findUnique({ where: { number: order.number }, select: { id: true } })) continue;

        const rows = await tx.product.findMany({
          where: { id: { in: order.items.map((item) => item.productId) } },
          select: { id: true, code: true, name: true, price: true },
        });
        const { lines, total } = buildOrderLines(order.items, new Map(rows.map((row) => [row.id, row])));
        await tx.order.create({
          data: {
            number: order.number,
            status: order.status,
            userId,
            placedAt: new Date(order.placedAt),
            total,
            items: { create: lines },
          },
        });
        ordersCreated += 1;
      }

      return { cartItems: DEMO_CART_ITEMS.length, orders: DEMO_ORDERS.length, ordersCreated };
    },
    { timeout: 30_000 },
  );
}

import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { MAX_CART_QUANTITY, type CartErrorCode, type CartLine, type CartView } from "./types";

// Data module of the cart. Every function takes the owner's userId, which only the session-checked
// service (cart-service.ts) passes in — never a value from the browser. Ownership is part of each
// SQL statement (owner check and mutation in one statement or one transaction), so a foreign or
// unknown id simply matches no row. Not server-only, so integration tests can use a test client.

type StoreResult = { ok: true; quantity?: number } | { ok: false; error: CartErrorCode };

const lineSelect = {
  id: true,
  quantity: true,
  product: { select: { id: true, code: true, name: true, image: true, price: true, amount: true } },
} satisfies Prisma.CartItemSelect;

/** The owner's cart with current prices; no Cart row yet means an empty cart (total 0). */
export async function readCart(client: PrismaClient, userId: string): Promise<CartView> {
  const cart = await client.cart.findUnique({
    where: { userId },
    select: { items: { select: lineSelect, orderBy: { id: "asc" } } },
  });

  const lines: CartLine[] = (cart?.items ?? []).map(({ id, quantity, product }) => ({
    itemId: id,
    productId: product.id,
    code: product.code,
    name: product.name,
    image: product.image,
    unitPrice: product.price,
    quantity,
    // int4 price × 99 fits in a double, the sum of many lines might not — bigint stays exact.
    lineTotal: BigInt(product.price) * BigInt(quantity),
    stock: product.amount,
    maxQuantity: Math.min(MAX_CART_QUANTITY, product.amount),
    exceedsStock: quantity > product.amount,
  }));

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.lineTotal, BigInt(0)),
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

class Rejected extends Error {
  constructor(readonly code: CartErrorCode) {
    super(code);
  }
}

/**
 * Adds one unit atomically. In one transaction: the cart is created or locked
 * (INSERT … ON CONFLICT ("userId")), then the line is inserted or incremented
 * (INSERT … ON CONFLICT ("cartId","productId") DO UPDATE … WHERE quantity < 99 AND quantity < stock).
 * A concurrent add of the same product waits for the conflicting row and re-checks the condition,
 * so two parallel adds give +2 when stock allows, and exactly one succeeds when one unit is left.
 * No duplicates (unique pair). A rejected add rolls back, so it never leaves an empty new cart.
 */
export async function addOne(client: PrismaClient, userId: string, productId: number): Promise<StoreResult> {
  try {
    return await client.$transaction(async (tx) => {
      const [cart] = await tx.$queryRaw<{ id: number }[]>`
        INSERT INTO "Cart" ("userId", "updatedAt") VALUES (${userId}, now())
        ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = now()
        RETURNING id`;

      const rows = await tx.$queryRaw<{ quantity: number }[]>`
        INSERT INTO "CartItem" ("cartId", "productId", "quantity")
        SELECT ${cart.id}, p.id, 1 FROM "Product" AS p WHERE p.id = ${productId} AND p.amount >= 1
        ON CONFLICT ("cartId", "productId") DO UPDATE SET quantity = "CartItem".quantity + 1
        WHERE "CartItem".quantity < ${MAX_CART_QUANTITY}
          AND "CartItem".quantity < (SELECT amount FROM "Product" WHERE id = "CartItem"."productId")
        RETURNING quantity`;

      if (rows.length === 0) throw new Rejected(await addRejection(tx, cart.id, productId));
      return { ok: true as const, quantity: rows[0].quantity };
    });
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, error: error.code };
    throw error;
  }
}

/** Why an add matched no row (only for the message; the decision was made by the statement above). */
async function addRejection(tx: Prisma.TransactionClient, cartId: number, productId: number): Promise<CartErrorCode> {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { amount: true } });
  if (product === null) return "product_not_found";
  if (product.amount < 1) return "out_of_stock";
  const item = await tx.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { quantity: true },
  });
  return item !== null && item.quantity >= MAX_CART_QUANTITY ? "limit_reached" : "insufficient_stock";
}

/**
 * Sets the quantity of one of the owner's lines. One UPDATE checks the item id, the owner of the
 * cart and the current stock together; 0 rows → foreign/unknown item or not enough stock.
 */
export async function updateQuantity(
  client: PrismaClient,
  userId: string,
  itemId: number,
  quantity: number,
): Promise<StoreResult> {
  const count = await client.$executeRaw`
    UPDATE "CartItem" AS ci SET quantity = ${quantity}
    FROM "Cart" AS c, "Product" AS p
    WHERE ci.id = ${itemId} AND c.id = ci."cartId" AND c."userId" = ${userId}
      AND p.id = ci."productId" AND p.amount >= ${quantity}`;
  if (count === 1) return { ok: true, quantity };

  // Owner-scoped read: another user's item looks exactly like a missing one.
  const own = await client.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, select: { id: true } });
  return { ok: false, error: own ? "insufficient_stock" : "item_not_found" };
}

/** Deletes one of the owner's lines; the owner condition is part of the DELETE itself. */
export async function deleteItem(client: PrismaClient, userId: string, itemId: number): Promise<StoreResult> {
  const count = await client.$executeRaw`
    DELETE FROM "CartItem" AS ci USING "Cart" AS c
    WHERE ci.id = ${itemId} AND c.id = ci."cartId" AND c."userId" = ${userId}`;
  return count === 1 ? { ok: true } : { ok: false, error: "item_not_found" };
}

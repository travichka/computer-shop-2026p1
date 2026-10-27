import type { PrismaClient } from "@/lib/generated/prisma/client";
import { isProductIdInRange } from "./product-id";
import { MAX_INT32 } from "./validation";

// Stock writes for local scripts and tests only — no public form or API (sessions come in Lab 09).
// Takes a client explicitly and is not server-only, so tsx scripts can use it.

export class StockUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockUpdateError";
  }
}

/**
 * Sets `amount` of one existing product. Validates the id and the new amount (0..2147483647) first,
 * then requires exactly one changed row; anything else rolls the transaction back.
 */
export async function setProductAmount(
  client: PrismaClient,
  id: number,
  amount: number,
): Promise<{ id: number; before: number; after: number }> {
  if (!isProductIdInRange(id)) throw new StockUpdateError(`Invalid product id ${id}.`);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_INT32) {
    throw new StockUpdateError(`Invalid amount ${amount}: an integer 0..${MAX_INT32} is required.`);
  }

  return client.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, select: { amount: true } });
    const { count } = await tx.product.updateMany({ where: { id }, data: { amount } });
    if (count !== 1 || current === null) {
      throw new StockUpdateError(`Expected exactly one changed product, got ${count} (id ${id}).`);
    }
    return { id, before: current.amount, after: amount };
  });
}

/**
 * Extension "Zapis współbieżny": atomic reservation. One conditional UPDATE
 * (… SET amount = amount - q WHERE id = $1 AND amount >= q) — the row lock taken by the UPDATE
 * makes concurrent attempts wait and re-check the condition, so stock can never go below zero
 * and exactly as many reservations succeed as there are units. No separate read, no retry needed.
 */
export async function reserveStock(client: PrismaClient, id: number, quantity: number): Promise<boolean> {
  if (!isProductIdInRange(id)) throw new StockUpdateError(`Invalid product id ${id}.`);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new StockUpdateError(`Invalid quantity ${quantity}.`);

  const { count } = await client.product.updateMany({
    where: { id, amount: { gte: quantity } },
    data: { amount: { decrement: quantity } },
  });
  return count === 1;
}

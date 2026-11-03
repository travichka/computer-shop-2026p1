import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { OrderView } from "./types";

// Data module of the order history. Like the cart, every query is scoped by the owner's userId,
// which only the session-checked service passes in. Values come from the stored snapshot
// (OrderItem), never from the current Product row.

const orderSelect = {
  number: true,
  status: true,
  placedAt: true,
  total: true,
  items: {
    select: { productId: true, productCode: true, productName: true, unitPrice: true, quantity: true, lineTotal: true },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

function toOrderView({ items, placedAt, ...order }: OrderRow): OrderView {
  return { ...order, placedAt: placedAt.toISOString(), lines: items };
}

/** The owner's orders, newest first (index Order_userId_placedAt_idx). */
export async function listOrders(client: PrismaClient, userId: string): Promise<OrderView[]> {
  const rows = await client.order.findMany({
    where: { userId },
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    select: orderSelect,
  });
  return rows.map(toOrderView);
}

/** One of the owner's orders; someone else's order and a missing number both give null. */
export async function findOrder(client: PrismaClient, userId: string, number: string): Promise<OrderView | null> {
  const row = await client.order.findFirst({ where: { number, userId }, select: orderSelect });
  return row === null ? null : toOrderView(row);
}

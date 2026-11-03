import type { OwnerSession } from "@/lib/cart/cart-service";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { findOrder, listOrders } from "./order-store";
import { parseOrderNumber, type OrderView } from "./types";

export interface OrderServiceDeps {
  getSession: () => Promise<OwnerSession | null>;
  getClient: () => PrismaClient;
}

export type MyOrders = { signedIn: false } | { signedIn: true; orders: OrderView[] };
export type MyOrder = { signedIn: false } | { signedIn: true; order: OrderView | null };

/** Read-only history of the signed-in user; the owner is the verified session of the request. */
export function createOrderService({ getSession, getClient }: OrderServiceDeps) {
  return {
    async getMyOrders(): Promise<MyOrders> {
      const session = await getSession();
      if (!session) return { signedIn: false };
      return { signedIn: true, orders: await listOrders(getClient(), session.user.id) };
    },

    /** An invalid number, a missing order and someone else's order all give order: null. */
    async getMyOrder(rawNumber: unknown): Promise<MyOrder> {
      const session = await getSession();
      if (!session) return { signedIn: false };
      const number = parseOrderNumber(rawNumber);
      return { signedIn: true, order: number === null ? null : await findOrder(getClient(), session.user.id, number) };
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;

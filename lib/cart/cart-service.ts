import type { PrismaClient } from "@/lib/generated/prisma/client";
import { addOne, deleteItem, readCart, updateQuantity } from "./cart-store";
import { cartError, type CartResult, type CartView } from "./types";
import { parseCartItemId, parseCartProductId, parseCartQuantity } from "./validation";

// Protected cart operations (Table 5.1). None of them accepts an owner id, a price or a total:
// the owner is always session.user.id of the current request, prices come from the database.

/** Minimal shape of a verified Better Auth session that the cart needs. */
export interface OwnerSession {
  user: { id: string };
}

export interface CartServiceDeps {
  /** Verifies the session of the current request (auth.api.getSession); null = not signed in. */
  getSession: () => Promise<OwnerSession | null>;
  getClient: () => PrismaClient;
  /** Server-side logging of unexpected failures (the user only gets a generic message). */
  logError?: (error: unknown) => void;
}

export type MyCart = { signedIn: false } | { signedIn: true; cart: CartView };

export function createCartService({ getSession, getClient, logError = console.error }: CartServiceDeps) {
  /**
   * THE place where the owner is determined: the id of the verified session of this request,
   * looked up on every call (no module-level or shared "current user").
   */
  async function ownerId(): Promise<string | null> {
    const session = await getSession();
    return session?.user.id ?? null;
  }

  /** Expected failures are results; unexpected ones (database down, …) are logged and hidden. */
  async function guarded(operation: (userId: string) => Promise<CartResult>): Promise<CartResult> {
    try {
      const userId = await ownerId();
      if (userId === null) return cartError("unauthenticated");
      return await operation(userId);
    } catch (error) {
      logError(error);
      return cartError("unavailable");
    }
  }

  return {
    /** Owner's cart. A database failure is thrown (error boundary), never shown as an empty cart. */
    async getMyCart(): Promise<MyCart> {
      const userId = await ownerId();
      if (userId === null) return { signedIn: false };
      return { signedIn: true, cart: await readCart(getClient(), userId) };
    },

    /** Adds one unit of an existing, available product; an existing line is incremented. */
    addProduct(rawProductId: unknown): Promise<CartResult> {
      return guarded(async (userId) => {
        const productId = parseCartProductId(rawProductId);
        if (productId === null) return cartError("invalid_product_id");
        const result = await addOne(getClient(), userId, productId);
        return result.ok ? result : cartError(result.error);
      });
    },

    /** Sets a validated quantity (1..99, ≤ stock) on one of the owner's own lines. */
    setQuantity(rawItemId: unknown, rawQuantity: unknown): Promise<CartResult> {
      return guarded(async (userId) => {
        const itemId = parseCartItemId(rawItemId);
        if (itemId === null) return cartError("invalid_item_id");
        const quantity = parseCartQuantity(rawQuantity);
        if (quantity === null) return cartError("invalid_quantity");
        const result = await updateQuantity(getClient(), userId, itemId, quantity);
        return result.ok ? result : cartError(result.error);
      });
    },

    /** Removes one of the owner's own lines. */
    removeItem(rawItemId: unknown): Promise<CartResult> {
      return guarded(async (userId) => {
        const itemId = parseCartItemId(rawItemId);
        if (itemId === null) return cartError("invalid_item_id");
        const result = await deleteItem(getClient(), userId, itemId);
        return result.ok ? result : cartError(result.error);
      });
    },
  };
}

export type CartService = ReturnType<typeof createCartService>;

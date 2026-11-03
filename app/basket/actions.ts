"use server";

import { revalidatePath } from "next/cache";
import { cartService } from "@/lib/cart/server";
import type { CartActionState, CartResult } from "@/lib/cart/types";

// Server Actions of the cart, callable from the browser. Each one is a public POST endpoint, so
// "use server" alone authorizes nothing: cartService verifies the session of this request and
// takes the owner from it. Next.js accepts actions only as POST with a matching Origin/Host
// (CSRF protection of this mechanism) and the session cookie is SameSite=Lax.
// Closed input contract: only the named fields are read from the form; no owner, price or total.

function field(formData: unknown, name: string): unknown {
  // A hand-crafted call may send anything instead of FormData.
  return formData instanceof FormData ? formData.get(name) : undefined;
}

function refreshed(result: CartResult): CartActionState {
  // Fresh server data on /basket after a successful write; nothing is revalidated on failure.
  if (result.ok) revalidatePath("/basket");
  return result;
}

export async function addProductAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  return refreshed(await cartService.addProduct(field(formData, "productId")));
}

export async function setQuantityAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  return refreshed(await cartService.setQuantity(field(formData, "itemId"), field(formData, "quantity")));
}

export async function removeItemAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  return refreshed(await cartService.removeItem(field(formData, "itemId")));
}

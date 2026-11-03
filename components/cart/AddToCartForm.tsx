"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addProductAction } from "@/app/basket/actions";
import type { CartActionState } from "@/lib/cart/types";

/**
 * "Add to cart" for the catalog and the details page. Disabling the button for an unavailable
 * product is only a hint — the server action checks the session, the product and the stock again.
 */
export default function AddToCartForm({ productId, available }: { productId: number; available: boolean }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(addProductAction, null);
  const messageId = `add-to-cart-${productId}`;

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={!available || pending} aria-busy={pending} aria-describedby={state ? messageId : undefined}>
        {pending ? "Dodawanie…" : available ? "Dodaj do koszyka" : "Niedostępny"}
      </button>
      {state && (
        <p id={messageId} role={state.ok ? "status" : "alert"} className={`my-1 text-sm ${state.ok ? "text-ok" : "text-bad"}`}>
          {state.ok ? (
            <>
              Dodano — w koszyku {state.quantity} szt.{" "}
              <Link href="/basket" className="text-ink">
                Przejdź do koszyka
              </Link>
            </>
          ) : state.error === "unauthenticated" ? (
            <>
              {state.message}{" "}
              <Link href="/login?next=/basket" className="text-ink">
                Zaloguj się
              </Link>
            </>
          ) : (
            state.message
          )}
        </p>
      )}
    </form>
  );
}

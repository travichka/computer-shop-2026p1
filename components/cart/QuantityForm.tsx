"use client";

import { useActionState } from "react";
import { setQuantityAction } from "@/app/basket/actions";
import { MAX_CART_QUANTITY, type CartActionState } from "@/lib/cart/types";

/** Changes the quantity of one own line; the error is linked to the field (aria-describedby). */
export default function QuantityForm({ itemId, quantity, name }: { itemId: number; quantity: number; name: string }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(setQuantityAction, null);
  const inputId = `quantity-${itemId}`;
  const errorId = `quantity-error-${itemId}`;
  const error = state && !state.ok ? state : null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={inputId} className="sr-only">
        Ilość: {name}
      </label>
      <input
        id={inputId}
        name="quantity"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_CART_QUANTITY}
        step={1}
        required
        defaultValue={quantity}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-16 rounded border-2 border-ink bg-white px-1 text-ink"
      />
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Zapisywanie…" : "Zmień"}
      </button>
      {error && (
        <span id={errorId} role="alert" className="basis-full text-sm font-bold text-bad">
          {error.message}
        </span>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { removeItemAction } from "@/app/basket/actions";
import type { CartActionState } from "@/lib/cart/types";

/** Removes one own line (a separate operation — quantity 0 is a validation error). */
export default function RemoveItemForm({ itemId, name }: { itemId: number; name: string }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(removeItemAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={itemId} />
      <button type="submit" disabled={pending} aria-busy={pending} aria-label={`Usuń z koszyka: ${name}`}>
        {pending ? "Usuwanie…" : "Usuń"}
      </button>
      {state && !state.ok && (
        <span role="alert" className="block text-sm font-bold text-bad">
          {state.message}
        </span>
      )}
    </form>
  );
}

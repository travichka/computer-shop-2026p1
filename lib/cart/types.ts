// Cart contract shared by the data module, the session-checked service, server actions and views.
// Types and constants only — safe to import in client components.

/** Upper bound of one cart line (also CHECK cart_item_quantity_range in SQL). */
export const MAX_CART_QUANTITY = 99;

export interface CartLine {
  itemId: number;
  productId: number;
  code: string;
  name: string;
  image: string;
  /** Current product price in grosze, read from the database — never from the browser. */
  unitPrice: number;
  quantity: number;
  /** unitPrice × quantity in grosze (bigint: exact beyond 2^53). */
  lineTotal: bigint;
  /** Current stock; the cart does not reserve units. */
  stock: number;
  /** Highest quantity that setQuantity accepts now: min(99, stock). */
  maxQuantity: number;
  /** Stock fell below the quantity after it was added — the line needs a correction. */
  exceedsStock: boolean;
}

export interface CartView {
  lines: CartLine[];
  /** Sum of line totals in grosze; 0n for an empty cart (or no cart row yet). */
  total: bigint;
  /** Sum of quantities. */
  units: number;
}

export type CartErrorCode =
  | "unauthenticated"
  | "invalid_product_id"
  | "invalid_item_id"
  | "invalid_quantity"
  | "product_not_found"
  | "out_of_stock"
  | "insufficient_stock"
  | "limit_reached"
  | "item_not_found"
  | "unavailable";

/** Form field an error belongs to (for aria-describedby in the views). */
export type CartField = "productId" | "itemId" | "quantity";

export type CartResult =
  | { ok: true; quantity?: number }
  | { ok: false; error: CartErrorCode; field?: CartField; message: string };

export const CART_ERROR_MESSAGES: Record<CartErrorCode, string> = {
  unauthenticated: "Zaloguj się, aby zmieniać koszyk.",
  invalid_product_id: "Niepoprawny identyfikator produktu.",
  invalid_item_id: "Niepoprawny identyfikator pozycji koszyka.",
  invalid_quantity: `Ilość musi być liczbą całkowitą od 1 do ${MAX_CART_QUANTITY}. Aby usunąć pozycję, użyj „Usuń”.`,
  product_not_found: "Taki produkt nie istnieje.",
  out_of_stock: "Produkt jest niedostępny.",
  insufficient_stock: "W magazynie nie ma tylu sztuk tego produktu.",
  limit_reached: `W koszyku może być najwyżej ${MAX_CART_QUANTITY} sztuk jednego produktu.`,
  // Same answer for someone else's item and for an id that does not exist — nothing is revealed.
  item_not_found: "Nie znaleziono takiej pozycji w Twoim koszyku.",
  unavailable: "Nie udało się zapisać zmian. Spróbuj ponownie za chwilę.",
};

const ERROR_FIELDS: Partial<Record<CartErrorCode, CartField>> = {
  invalid_product_id: "productId",
  invalid_item_id: "itemId",
  invalid_quantity: "quantity",
  insufficient_stock: "quantity",
  limit_reached: "quantity",
};

export function cartError(error: CartErrorCode): Extract<CartResult, { ok: false }> {
  const field = ERROR_FIELDS[error];
  return { ok: false, error, message: CART_ERROR_MESSAGES[error], ...(field ? { field } : {}) };
}

/** State of a cart form driven by useActionState: null before the first submit. */
export type CartActionState = CartResult | null;

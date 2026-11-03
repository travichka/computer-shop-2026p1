// Order history contract (extension "Historia użytkownika"). Types and constants only.

export const ORDER_STATUS_LABELS = {
  PENDING: "Oczekuje",
  PAID: "Opłacone",
  SHIPPED: "Wysłane",
  DELIVERED: "Dostarczone",
  CANCELLED: "Anulowane",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

/** One line as stored at purchase time — not the current product data. */
export interface OrderLine {
  /** null when the product was deleted later (SetNull); the snapshot below stays. */
  productId: number | null;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: bigint;
}

export interface OrderView {
  number: string;
  status: OrderStatus;
  /** UTC ISO timestamp. */
  placedAt: string;
  total: bigint;
  lines: OrderLine[];
}

/** Public order number, e.g. ZAM-2026-0001 (same format as CHECK order_number_format). */
const ORDER_NUMBER = /^ZAM-[0-9]{4}-[0-9]{4}$/;

export function parseOrderNumber(raw: unknown): string | null {
  return typeof raw === "string" && ORDER_NUMBER.test(raw) ? raw : null;
}

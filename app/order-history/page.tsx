import type { Metadata } from "next";
import Link from "next/link";
import SignInButton from "@/components/auth/SignInButton";
import OrderLines from "@/components/orders/OrderLines";
import { formatDate, formatPrice } from "@/lib/format";
import { orderService } from "@/lib/orders/server";
import { ORDER_STATUS_LABELS } from "@/lib/orders/types";

export const metadata: Metadata = { title: "Historia zamówień" };

const PANEL = "rounded-lg bg-paper p-6 text-ink";

// Extension "Historia użytkownika": only the orders of the signed-in user, with the values stored
// at purchase time. A database failure reaches error.tsx instead of looking like "no orders".
export default async function OrderHistoryPage() {
  const my = await orderService.getMyOrders();

  if (!my.signedIn) {
    return (
      <section className="content placeholder" aria-labelledby="history-title">
        <h1 id="history-title">Historia zamówień</h1>
        <p role="status">Historia zamówień jest dostępna po zalogowaniu.</p>
        <SignInButton returnTo="/order-history" />
      </section>
    );
  }

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title">Historia zamówień</h1>
      {my.orders.length === 0 ? (
        <p role="status" className={PANEL}>
          Nie masz jeszcze żadnych zamówień. Składanie zamówień nie jest jeszcze dostępne.
        </p>
      ) : (
        <ul className="m-0 grid gap-4 p-0">
          {my.orders.map((order) => (
            <li key={order.number} className={PANEL}>
              <h2 className="mt-0 font-heading text-lg">
                <Link href={`/order-history/${order.number}`} className="text-ink">
                  {order.number}
                </Link>
              </h2>
              <p className="my-1 text-sm">
                {ORDER_STATUS_LABELS[order.status]} · <time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time>
              </p>
              <OrderLines lines={order.lines} />
              <p className="mb-0">
                Razem: <strong>{formatPrice(order.total)}</strong>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

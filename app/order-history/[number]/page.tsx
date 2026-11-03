import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SignInButton from "@/components/auth/SignInButton";
import OrderLines from "@/components/orders/OrderLines";
import { formatDate, formatPrice } from "@/lib/format";
import { orderService } from "@/lib/orders/server";
import { ORDER_STATUS_LABELS } from "@/lib/orders/types";

export const metadata: Metadata = { title: "Zamówienie" };

// /order-history/<number>: swapping in another user's number gives the same 404 as a number that
// does not exist — the page never reveals whether someone else's order exists.
export default async function OrderPage({ params }: PageProps<"/order-history/[number]">) {
  const my = await orderService.getMyOrder((await params).number);

  if (!my.signedIn) {
    return (
      <section className="content placeholder" aria-labelledby="order-title">
        <h1 id="order-title">Zamówienie</h1>
        <p role="status">Zamówienia są dostępne po zalogowaniu.</p>
        <SignInButton returnTo="/order-history" />
      </section>
    );
  }
  if (my.order === null) notFound();

  const { order } = my;
  return (
    <section aria-labelledby="order-title" className="rounded-lg bg-paper p-6 text-ink">
      <p className="mt-0">
        <Link href="/order-history" className="text-ink">
          ← Wróć do historii
        </Link>
      </p>
      <h1 id="order-title" className="font-heading">
        Zamówienie {order.number}
      </h1>
      <p>
        {ORDER_STATUS_LABELS[order.status]} · <time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time>
      </p>
      <OrderLines lines={order.lines} />
      <p className="mb-0">
        Razem: <strong>{formatPrice(order.total)}</strong>
      </p>
    </section>
  );
}

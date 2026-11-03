import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SignInButton from "@/components/auth/SignInButton";
import QuantityForm from "@/components/cart/QuantityForm";
import RemoveItemForm from "@/components/cart/RemoveItemForm";
import { cartService } from "@/lib/cart/server";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Koszyk" };

const PANEL = "rounded-lg bg-paper p-6 text-ink";

// Server Component: the cart is read for the owner of the verified session of this request
// (reading needs no "use server"). Rendered per request — nothing private is cached.
export default async function BasketPage() {
  const my = await cartService.getMyCart();

  if (!my.signedIn) {
    return (
      <section className="content placeholder" aria-labelledby="basket-title">
        <h1 id="basket-title">Koszyk</h1>
        <p role="status">Koszyk jest dostępny po zalogowaniu.</p>
        <SignInButton returnTo="/basket" />
      </section>
    );
  }

  const { cart } = my;

  return (
    <section aria-labelledby="basket-title">
      <h1 id="basket-title">Koszyk</h1>
      {cart.lines.length === 0 ? (
        <div className={PANEL}>
          <p role="status" className="mt-0">
            Twój koszyk jest pusty.
          </p>
          <p>
            Suma: <strong>{formatPrice(cart.total)}</strong>
          </p>
          <p className="mb-0">
            <Link href="/product-list" className="text-ink">
              Przejdź do katalogu
            </Link>
          </p>
        </div>
      ) : (
        <div className={PANEL}>
          <ul className="m-0 grid gap-4 p-0">
            {cart.lines.map((line) => (
              <li key={line.itemId} className="flex flex-wrap items-start gap-4 border-b border-control pb-4">
                <Image src={line.image} alt="" width={72} height={72} className="rounded-md" />
                <div className="min-w-0 flex-1">
                  <h2 className="mt-0 mb-1 font-heading text-base wrap-anywhere">
                    <Link href={`/product-list/${line.productId}`} className="text-ink">
                      {line.name}
                    </Link>
                  </h2>
                  <p className="my-1 text-sm">Cena jednostkowa: {formatPrice(line.unitPrice)}</p>
                  {line.exceedsStock && (
                    <p role="alert" className="my-1 text-sm font-bold text-bad">
                      {line.stock === 0
                        ? "Produkt jest już niedostępny — usuń pozycję."
                        : `Dostępne są już tylko ${line.stock} szt. — zmniejsz ilość lub usuń pozycję.`}
                    </p>
                  )}
                  <QuantityForm itemId={line.itemId} quantity={line.quantity} name={line.name} />
                </div>
                <div className="text-right">
                  <p className="my-1">
                    Wartość: <strong>{formatPrice(line.lineTotal)}</strong>
                  </p>
                  <RemoveItemForm itemId={line.itemId} name={line.name} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-lg">
            Razem ({cart.units} szt.): <strong>{formatPrice(cart.total)}</strong>
          </p>
          <p className="mb-0 text-sm">
            Ceny i suma są liczone na serwerze z aktualnych danych produktów. Koszyk nie rezerwuje towaru.
          </p>
          <p className="mb-0">
            <button type="button" disabled aria-describedby="checkout-note">
              Złóż zamówienie
            </button>{" "}
            <span id="checkout-note" className="text-sm">
              Składanie zamówień nie jest jeszcze dostępne.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Koszyk" };

// A missing feature is a normal, expected state — not an error and not a 404.
export default function BasketPage() {
  return (
    <section className="content placeholder" aria-labelledby="basket-title">
      <h1 id="basket-title">Koszyk</h1>
      <p role="status">Koszyk nie został jeszcze zaimplementowany.</p>
      <p>
        Ta funkcja pojawi się na kolejnych zajęciach. Tymczasem możesz <Link href="/product-list">przejrzeć katalog</Link>.
      </p>
    </section>
  );
}

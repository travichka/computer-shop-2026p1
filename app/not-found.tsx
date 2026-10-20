import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Nie znaleziono strony" };

export default function NotFound() {
  return (
    <section className="content error" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Nie znaleziono strony</h1>
      <p>Strona o podanym adresie nie istnieje albo została przeniesiona.</p>
      <p>
        <Link href="/">Wróć na stronę główną</Link> lub <Link href="/product-list">przejdź do katalogu</Link>.
      </p>
    </section>
  );
}

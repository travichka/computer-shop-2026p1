import Link from "next/link";

// Shown for notFound() from /product-list/[id] and /product-list/[id]/image.
export default function ProductNotFound() {
  return (
    <section className="content error" aria-labelledby="product-not-found-title">
      <h1 id="product-not-found-title">Nie znaleziono produktu</h1>
      <p>Produkt o podanym identyfikatorze nie istnieje albo adres jest niepoprawny.</p>
      <p>
        <Link href="/product-list">Wróć do katalogu</Link>
      </p>
    </section>
  );
}

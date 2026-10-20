import type { Metadata } from "next";
import { connection } from "next/server";
import ProductList from "@/components/products/ProductList";
import { productRepository } from "@/lib/products/repository";

export const metadata: Metadata = { title: "Katalog produktów" };

// Server Component: the repository runs only on the server; the browser receives rendered HTML
// plus the props of the small client components (here: one description string per product).
export default async function ProductListPage() {
  // Render per request, so a repository failure is handled by error.tsx at request time
  // instead of failing the static prerender during `next build`.
  await connection();
  const products = await productRepository.getProducts({ sort: "name" });

  return (
    <>
      <h1>Katalog produktów</h1>
      <p className="catalog-summary">Sortowanie: po nazwie (A–Z). Liczba produktów: {products.length}.</p>
      <ProductList products={products} />
    </>
  );
}

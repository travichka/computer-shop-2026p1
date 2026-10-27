import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ProductDetails from "@/components/products/ProductDetails";
import { formatPrice } from "@/lib/format";
import { parseCatalogSlug } from "@/lib/products/catalog-slug";
import { productRepository } from "@/lib/products/repository";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/products/types";

// Extension: optional catch-all [[...slug]]. Path segments arrive as an array:
//   /catalog           → slug undefined → list of categories
//   /catalog/gpu       → ["gpu"]        → products in the category
//   /catalog/gpu/12    → ["gpu", "12"]  → product 12, only if it really is a GPU
// A required catch-all [...slug] would not match /catalog itself (404 without a separate page.tsx).

export async function generateMetadata({ params }: PageProps<"/catalog/[[...slug]]">): Promise<Metadata> {
  const parsed = parseCatalogSlug((await params).slug);
  if (parsed === null) return { title: "Nie znaleziono strony" };
  if (parsed.kind === "root") return { title: "Kategorie" };
  return { title: `Kategoria: ${PRODUCT_TYPE_LABELS[parsed.type]}` };
}

export default async function CatalogSectionPage({ params }: PageProps<"/catalog/[[...slug]]">) {
  await connection();
  const parsed = parseCatalogSlug((await params).slug);
  if (parsed === null) notFound();

  if (parsed.kind === "root") {
    const products = await productRepository.getProducts({});
    return (
      <section className="content">
        <h1>Kategorie</h1>
        <ul className="bullets">
          {PRODUCT_TYPES.map((type) => (
            <li key={type}>
              <Link href={`/catalog/${type}`}>{PRODUCT_TYPE_LABELS[type]}</Link> (
              {products.filter((product) => product.type === type).length} produktów)
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (parsed.kind === "category") {
    const products = await productRepository.getProducts({ type: parsed.type, sort: "name" });
    return (
      <section className="content">
        <p>
          <Link href="/catalog">← Wszystkie kategorie</Link>
        </p>
        <h1>{PRODUCT_TYPE_LABELS[parsed.type]}</h1>
        <ul className="bullets">
          {products.map((product) => (
            <li key={product.id}>
              <Link href={`/catalog/${parsed.type}/${product.id}`}>{product.name}</Link> — {formatPrice(product.price)}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const product = await productRepository.getProductById(parsed.id);
  // The product must exist and belong to the category from the path (/catalog/cpu/<gpu id> → 404).
  if (product === null || product.type !== parsed.type) notFound();

  return (
    <ProductDetails
      product={product}
      backHref={`/catalog/${parsed.type}`}
      backLabel={`Wróć do kategorii ${PRODUCT_TYPE_LABELS[parsed.type]}`}
    />
  );
}

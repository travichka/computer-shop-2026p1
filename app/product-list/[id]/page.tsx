import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetails from "@/components/products/ProductDetails";
import { getProductForRoute } from "@/lib/products/product-page";
import { productRepository } from "@/lib/products/repository";

// Extension "Prerendering": the ten newest products are rendered during `next build`.
// dynamicParams = true — any other valid id is rendered on its first request (and then cached),
// so existing products outside the set still work; unknown ids still end in notFound().
export const dynamicParams = true;
const PRERENDERED_COUNT = 10;

export async function generateStaticParams() {
  const newest = await productRepository.getProducts({ sort: "newest" });
  return newest.slice(0, PRERENDERED_COUNT).map((product) => ({ id: String(product.id) }));
}

export async function generateMetadata({ params }: PageProps<"/product-list/[id]">): Promise<Metadata> {
  const product = await getProductForRoute((await params).id);
  if (!product) return { title: "Nie znaleziono produktu" };
  return { title: product.name, description: product.description };
}

// Invalid format, out-of-range id and an unknown id → notFound(); a repository failure is not
// caught, so it reaches error.tsx instead of pretending the product does not exist.
export default async function ProductPage({ params }: PageProps<"/product-list/[id]">) {
  const product = await getProductForRoute((await params).id);
  if (!product) notFound();

  return <ProductDetails product={product} />;
}

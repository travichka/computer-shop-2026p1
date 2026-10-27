import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ProductDetails from "@/components/products/ProductDetails";
import { getProductForRoute } from "@/lib/products/product-page";

// Lab 08: details and metadata read the current database state on every request. connection()
// opts out of prerendering here (not in the repository, which scripts and tests also use).
// The Lab 07 generateStaticParams/dynamicParams experiment was removed — it served stale pages.

export async function generateMetadata({ params }: PageProps<"/product-list/[id]">): Promise<Metadata> {
  await connection();
  const product = await getProductForRoute((await params).id);
  if (!product) return { title: "Nie znaleziono produktu" };
  return { title: product.name, description: product.description };
}

// Invalid format, out-of-range id and an unknown id → notFound(); a repository failure is not
// caught, so it reaches error.tsx instead of pretending the product does not exist.
export default async function ProductPage({ params }: PageProps<"/product-list/[id]">) {
  await connection();
  const product = await getProductForRoute((await params).id);
  if (!product) notFound();

  return <ProductDetails product={product} />;
}

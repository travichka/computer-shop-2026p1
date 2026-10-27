import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getProductForRoute } from "@/lib/products/product-page";

// Full page for the product image: direct entry and refresh of /product-list/<id>/image.
// Client navigation from the catalog is intercepted by @modal/(.)[id]/image instead.
export async function generateMetadata({ params }: PageProps<"/product-list/[id]/image">): Promise<Metadata> {
  await connection();
  const product = await getProductForRoute((await params).id);
  return { title: product ? `Ilustracja: ${product.name}` : "Nie znaleziono produktu" };
}

export default async function ProductImagePage({ params }: PageProps<"/product-list/[id]/image">) {
  await connection();
  const product = await getProductForRoute((await params).id);
  if (!product) notFound();

  return (
    <section className="content image-page" aria-labelledby="image-title">
      <h1 id="image-title">Ilustracja: {product.name}</h1>
      <Image src={product.image} alt={`Ilustracja produktu ${product.name}`} width={480} height={480} />
      <p>
        <Link href={`/product-list/${product.id}`}>← Wróć do produktu</Link>
      </p>
    </section>
  );
}

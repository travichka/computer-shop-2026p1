import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ImageModal from "@/components/products/ImageModal";
import { getProductForRoute } from "@/lib/products/product-page";

// Intercepting route: (.) matches /product-list/[id]/image relative to the product-list segment
// (the @modal slot is skipped when counting levels). Used only for client navigation inside the
// catalog section; direct entry and refresh render app/product-list/[id]/image/page.tsx.
export default async function ImageModalPage({ params }: PageProps<"/product-list/[id]/image">) {
  await connection();
  const product = await getProductForRoute((await params).id);
  if (!product) notFound();

  return (
    <ImageModal title={`Ilustracja: ${product.name}`} productHref={`/product-list/${product.id}`}>
      <Image src={product.image} alt={`Ilustracja produktu ${product.name}`} width={360} height={360} />
    </ImageModal>
  );
}

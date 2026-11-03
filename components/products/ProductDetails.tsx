import Image from "next/image";
import Link from "next/link";
import AddToCartForm from "@/components/cart/AddToCartForm";
import { formatDate, formatPrice } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, type Product } from "@/lib/products/types";

interface ProductDetailsProps {
  product: Product;
  /** Where "back to catalog" leads; works without browser history (direct entry). */
  backHref?: string;
  backLabel?: string;
}

// Tailwind CSS 4 utilities (extension); tokens such as bg-paper are defined in app/globals.css.
const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";
const ROW = "mb-1.5 flex flex-wrap gap-1.5";
const TERM = "font-bold after:content-[':']";

export default function ProductDetails({
  product,
  backHref = "/product-list",
  backLabel = "Wróć do katalogu",
}: ProductDetailsProps) {
  const available = product.amount > 0;
  const category = PRODUCT_TYPE_LABELS[product.type];

  return (
    <article className="rounded-lg bg-paper p-6 text-ink" aria-labelledby="product-title">
      <p className="mt-0">
        <Link href={backHref} className={`text-ink ${FOCUS}`}>
          ← {backLabel}
        </Link>
      </p>
      <h1 id="product-title" className="mt-2 font-heading wrap-anywhere">
        {product.name}
      </h1>
      <div className="flex flex-wrap gap-6">
        <Link href={`/product-list/${product.id}/image`} scroll={false} className={`self-start rounded-lg ${FOCUS}`}>
          <Image
            src={product.image}
            alt={`Powiększ ilustrację: ${product.name}`}
            width={240}
            height={240}
            className="h-auto max-w-full rounded-lg"
          />
        </Link>
        <dl className="m-0">
          <div className={ROW}>
            <dt className={TERM}>Kod</dt>
            <dd>
              <code>{product.code}</code>
            </dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Kategoria</dt>
            <dd>{category}</dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Cena</dt>
            <dd className="font-bold">{formatPrice(product.price)}</dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Stan magazynowy</dt>
            <dd className={`font-bold ${available ? "text-ok" : "text-bad"}`}>
              {available ? `Dostępny — ${product.amount} szt.` : "Niedostępny — 0 szt."}
            </dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Data dodania</dt>
            <dd>
              <time dateTime={product.date}>{formatDate(product.date)}</time>
            </dd>
          </div>
        </dl>
      </div>
      <AddToCartForm productId={product.id} available={available} />
      <h2>Opis</h2>
      <p className="mb-0">{product.description}</p>
    </article>
  );
}

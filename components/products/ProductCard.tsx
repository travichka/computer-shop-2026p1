import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, type Product } from "@/lib/products/types";
import DescriptionToggle from "./DescriptionToggle";
import styles from "./products.module.css";

export default function ProductCard({ product }: { product: Product }) {
  const available = product.amount > 0;
  const category = PRODUCT_TYPE_LABELS[product.type];

  return (
    <article className={styles.card} aria-labelledby={`product-${product.id}`}>
      {/* Client navigation to /product-list/<id>/image is intercepted by the @modal slot. */}
      <Link href={`/product-list/${product.id}/image`} className={styles.imageLink} scroll={false}>
        <Image
          src={product.image}
          alt={`Powiększ ilustrację: ${product.name}`}
          width={96}
          height={96}
          className={styles.image}
        />
      </Link>
      <div className={styles.body}>
        <h2 id={`product-${product.id}`} className={styles.name}>
          <Link href={`/product-list/${product.id}`}>{product.name}</Link>
        </h2>
        <dl className={styles.meta}>
          <div>
            <dt>Kategoria</dt>
            <dd>{category}</dd>
          </div>
          <div>
            <dt>Cena</dt>
            <dd className={styles.price}>{formatPrice(product.price)}</dd>
          </div>
          <div>
            <dt>Dostępność</dt>
            <dd className={available ? styles.available : styles.unavailable}>
              {available ? `Dostępny (${product.amount} szt.)` : "Niedostępny"}
            </dd>
          </div>
        </dl>
        <DescriptionToggle description={product.description} />
      </div>
    </article>
  );
}

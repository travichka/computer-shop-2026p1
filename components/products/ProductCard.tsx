import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, type Product } from "@/lib/products/types";
import DescriptionToggle from "./DescriptionToggle";
import styles from "./products.module.css";

export default function ProductCard({ product }: { product: Product }) {
  const available = product.amount > 0;
  const category = PRODUCT_TYPE_LABELS[product.type];

  return (
    <article className={styles.card} aria-labelledby={`product-${product.id}`}>
      <Image src={product.image} alt={`Ilustracja kategorii: ${category}`} width={96} height={96} className={styles.image} />
      <div className={styles.body}>
        <h2 id={`product-${product.id}`} className={styles.name}>
          {product.name}
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

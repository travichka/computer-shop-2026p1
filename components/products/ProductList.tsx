import type { Product } from "@/lib/products/types";
import ProductCard from "./ProductCard";
import styles from "./products.module.css";

export default function ProductList({ products }: { products: Product[] }) {
  // An empty result is a normal state, not an exception.
  if (products.length === 0) {
    return (
      <p role="status" className={styles.empty}>
        Brak produktów do wyświetlenia.
      </p>
    );
  }

  return (
    <ul className={styles.grid}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

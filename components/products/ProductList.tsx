import Link from "next/link";
import type { Product } from "@/lib/products/types";
import ProductCard from "./ProductCard";
import styles from "./products.module.css";

export default function ProductList({ products }: { products: Product[] }) {
  // An empty result is a normal state, not an exception.
  if (products.length === 0) {
    return (
      <div role="status" className={styles.empty}>
        <p>Brak produktów spełniających wybrane kryteria.</p>
        <Link href="/product-list">Wyczyść filtry</Link>
      </div>
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

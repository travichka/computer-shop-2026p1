import Link from "next/link";
import { connection } from "next/server";
import { formatPrice } from "@/lib/format";
import { getFeaturedProducts } from "@/lib/products/featured";
import { productRepository } from "@/lib/products/repository";
import styles from "./products.module.css";

// Server component rendered in the @featured slot; reads the same repository as the catalog,
// at request time like the pages around it.
export default async function FeaturedPanel() {
  await connection();
  const featured = await getFeaturedProducts(productRepository);

  return (
    <aside className={styles.featured} aria-labelledby="featured-title">
      <h2 id="featured-title">Polecane</h2>
      <p className={styles.featuredNote}>Trzy najnowsze dostępne produkty.</p>
      {featured.length === 0 ? (
        <p>Brak dostępnych produktów.</p>
      ) : (
        <ol>
          {featured.map((product) => (
            <li key={product.id}>
              <Link href={`/product-list/${product.id}`}>{product.name}</Link>
              <span className={styles.price}>{formatPrice(product.price)}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

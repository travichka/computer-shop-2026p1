import type { Metadata } from "next";
import { connection } from "next/server";
import CatalogFilters from "@/components/products/CatalogFilters";
import ProductList from "@/components/products/ProductList";
import { DEFAULT_CATALOG_SETTINGS, parseCatalogSearchParams, type CatalogParam } from "@/lib/products/catalog-params";
import { PARAM_LABELS, SORT_LABELS, STOCK_LABELS, TYPE_LABELS } from "@/lib/products/labels";
import { productRepository } from "@/lib/products/repository";

export const metadata: Metadata = { title: "Katalog produktów" };

const DEFAULT_LABELS: Record<CatalogParam, string> = {
  type: TYPE_LABELS[DEFAULT_CATALOG_SETTINGS.type],
  stock: STOCK_LABELS[DEFAULT_CATALOG_SETTINGS.stock],
  sort: SORT_LABELS[DEFAULT_CATALOG_SETTINGS.sort],
};

// Server Component: the URL is parsed and the repository runs only on the server; the browser
// receives rendered HTML plus the props of the small client components.
// The (list) route group does not change the URL; it only scopes loading.tsx to this page.
// Lab 08: connection() — the catalog reads the current database state on every request; a database
// failure is handled by error.tsx at request time (never an empty list or a build-time prerender).
export default async function ProductListPage({ searchParams }: PageProps<"/product-list">) {
  await connection();
  const { settings, criteria, invalid } = parseCatalogSearchParams(await searchParams);
  const products = await productRepository.getProducts(criteria);

  return (
    <>
      <h1>Katalog produktów</h1>
      <CatalogFilters settings={settings} />
      {invalid.length > 0 && (
        <ul role="status" className="notice">
          {invalid.map((param) => (
            <li key={param}>
              Pominięto błędne ustawienie {PARAM_LABELS[param]} — użyto wartości domyślnej „{DEFAULT_LABELS[param]}”.
            </li>
          ))}
        </ul>
      )}
      <p className="catalog-summary">
        Kategoria: {TYPE_LABELS[settings.type]} · dostępność: {STOCK_LABELS[settings.stock]} · sortowanie:{" "}
        {SORT_LABELS[settings.sort]} · liczba produktów: {products.length}
      </p>
      <ProductList products={products} />
    </>
  );
}

import Link from "next/link";

// Catalog section layout: shared by the list now and by product details (/product-list/[id]) in Lab 07.
// The breadcrumb and the pricing note stay mounted while moving between list and details.
export default function CatalogLayout({ children }: LayoutProps<"/product-list">) {
  return (
    <div className="catalog">
      <nav aria-label="Okruszki" className="breadcrumbs">
        <ol>
          <li>
            <Link href="/">Start</Link>
          </li>
          <li>
            <Link href="/product-list">Katalog</Link>
          </li>
        </ol>
      </nav>
      {children}
      <aside className="catalog-note" aria-label="Informacje o cenach">
        Ceny brutto w złotych (PLN). Produkty z zerowym stanem są widoczne, ale oznaczone jako niedostępne.
      </aside>
    </div>
  );
}

import Link from "next/link";

// Catalog section layout: shared by the list and product details (/product-list/[id]).
// The breadcrumb, the pricing note and the @featured panel stay mounted while moving between them.
// Slots (@featured, @modal) are props of this layout, not URL segments.
export default function CatalogLayout({ children, featured, modal }: LayoutProps<"/product-list">) {
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
      <div className="catalog-columns">
        <div className="catalog-main">{children}</div>
        {featured}
      </div>
      <aside className="catalog-note" aria-label="Informacje o cenach">
        Ceny brutto w złotych (PLN). Produkty z zerowym stanem są widoczne, ale oznaczone jako niedostępne.
      </aside>
      {modal}
    </div>
  );
}

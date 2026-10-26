// Suspense fallback for the catalog list only. The (list) route group keeps it away from
// /product-list/[id]: there notFound() runs before streaming starts, so the response is a real 404.
export default function CatalogLoading() {
  return (
    <div role="status" aria-live="polite" className="loading">
      <p>Ładowanie produktów…</p>
    </div>
  );
}

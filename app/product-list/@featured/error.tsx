"use client";

// Independent error boundary of the slot: a failing panel does not hide the catalog.
export default function FeaturedError() {
  return (
    <aside className="featured-error" role="alert">
      Nie udało się wczytać polecanych produktów.
    </aside>
  );
}

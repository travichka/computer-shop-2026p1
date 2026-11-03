"use client"; // Error boundaries must be Client Components

import DataErrorView from "@/components/DataErrorView";

// A database failure while reading the cart lands here — it is never shown as an empty cart.
export default function BasketError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <DataErrorView {...props} title="Nie udało się wczytać koszyka" />;
}

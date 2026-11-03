"use client"; // Error boundaries must be Client Components

import DataErrorView from "@/components/DataErrorView";

export default function OrderHistoryError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <DataErrorView {...props} title="Nie udało się wczytać historii zamówień" />;
}

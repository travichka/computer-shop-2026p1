"use client"; // Error boundaries must be Client Components

import DataErrorView from "@/components/DataErrorView";

// Catches failures of the catalog page and of nested segments (product details, image page).
// retry() (stable since Next.js 16.3) re-fetches and re-renders the segment.
export default function CatalogError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <DataErrorView {...props} />;
}

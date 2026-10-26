"use client"; // Error boundaries must be Client Components

import DataErrorView from "@/components/DataErrorView";

export default function CatalogSectionError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <DataErrorView {...props} />;
}

"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function CatalogError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // In production the message of a server error is replaced by a generic one;
    // the digest lets us match this report with the server log.
    console.error(error);
  }, [error]);

  return (
    <section className="content error" role="alert" aria-labelledby="catalog-error-title">
      <h1 id="catalog-error-title">Nie udało się wczytać katalogu</h1>
      <p>Wystąpił nieoczekiwany problem po stronie serwera. Spróbuj ponownie za chwilę.</p>
      {error.digest && <p className="muted">Kod zgłoszenia: {error.digest}</p>}
      <button type="button" onClick={() => retry()}>
        Spróbuj ponownie
      </button>
    </section>
  );
}

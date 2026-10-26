"use client";

import { useEffect } from "react";

/**
 * Safe failure view used by the error.tsx boundaries. It never shows the server error message
 * (production replaces it anyway); the digest lets us match the report with the server log.
 */
export default function DataErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="content error" role="alert" aria-labelledby="data-error-title">
      <h1 id="data-error-title">Nie udało się wczytać danych produktów</h1>
      <p>Wystąpił nieoczekiwany problem po stronie serwera. Spróbuj ponownie za chwilę.</p>
      {error.digest && <p className="muted">Kod zgłoszenia: {error.digest}</p>}
      <button type="button" onClick={() => retry()}>
        Spróbuj ponownie
      </button>
    </section>
  );
}

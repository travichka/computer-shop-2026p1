import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Historia zamówień" };

export default function OrderHistoryPage() {
  return (
    <section className="content placeholder" aria-labelledby="history-title">
      <h1 id="history-title">Historia zamówień</h1>
      <p role="status">Historia nie została jeszcze zaimplementowana.</p>
      <p>
        Ta funkcja pojawi się na kolejnych zajęciach. Wróć do <Link href="/product-list">katalogu produktów</Link>.
      </p>
    </section>
  );
}

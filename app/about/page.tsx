import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "O sklepie" };

export default function AboutPage() {
  return (
    <article className="content">
      <h1>O sklepie</h1>
      <p>
        {SITE.name} to fikcyjny sklep z podzespołami komputerowymi: procesorami, kartami graficznymi, pamięcią RAM i
        dyskami. Ceny są podawane w złotych brutto, a stan magazynowy pokazuje, czy produkt jest dostępny.
      </p>
      <h2>O projekcie</h2>
      <p>
        Projekt powstaje w ramach przedmiotu {SITE.course}. Dane katalogu są przechowywane w bazie PostgreSQL
        i odczytywane po stronie serwera przez Prisma ORM.
      </p>
      <h2>Etapy</h2>
      <ul className="bullets">
        <li>Lab 06 — routing, wspólny layout, repozytorium produktów, obsługa pustego wyniku, 404 i awarii.</li>
        <li>Lab 07 — filtry katalogu w adresie i strona szczegółów produktu.</li>
        <li>Lab 08 — baza PostgreSQL i Prisma zamiast pliku JSON, bez zmiany widoków.</li>
        <li>Lab 09 — logowanie, koszyk i historia zamówień.</li>
      </ul>
    </article>
  );
}

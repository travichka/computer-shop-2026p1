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
        Projekt powstaje w ramach przedmiotu {SITE.course}. Laboratorium 06 obejmuje routing w App Router, wspólny
        layout, repozytorium produktów po stronie serwera z walidacją danych oraz obsługę pustego wyniku, nieznanego
        adresu i awarii.
      </p>
      <h2>Plan rozwoju</h2>
      <ul className="bullets">
        <li>Lab 07 — filtry katalogu i strona szczegółów produktu.</li>
        <li>Lab 08 — zastąpienie pliku JSON bazą PostgreSQL bez zmiany widoków.</li>
        <li>Kolejne zajęcia — koszyk i historia zamówień.</li>
      </ul>
    </article>
  );
}

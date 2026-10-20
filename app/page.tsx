import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <div id="home">
      <Image
        src="/images/politechnika-krakowska-logo.svg"
        alt="Logo Politechniki Krakowskiej"
        width={160}
        height={156}
        priority
      />
      <h1>{SITE.name}</h1>
      <p>
        Podstawa aplikacji sklepu komputerowego rozwijanej na kolejnych laboratoriach: katalog procesorów, kart
        graficznych, pamięci RAM i dysków, czytany po stronie serwera przez repozytorium produktów.
      </p>
      <p>
        Autor: <strong>{SITE.author}</strong>
        <br />
        {SITE.course}
      </p>
      <Link href="/product-list">Przejdź do katalogu</Link>
    </div>
  );
}

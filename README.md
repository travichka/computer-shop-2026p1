# Computer Shop 2026 — Lab 07

Autorka: Anastasiia Muzyka

Sklep komputerowy (Programowanie BackEnd, KIS M-7, PK). Lab 06 dał podstawę: routing App Router, wspólny
layout, repozytorium produktów po stronie serwera z walidacją danych, obsługę pustego wyniku, 404 i awarii.
Lab 07 dodaje stronę szczegółów produktu `/product-list/[id]` z walidacją identyfikatora, filtry i sortowanie
katalogu zapisane w adresie, wyróżnienie aktywnej sekcji w nawigacji oraz wszystkie pięć rozszerzeń.

## Wersje

| Narzędzie | Wersja |
| --- | --- |
| Node.js | 24.22.1 (24 LTS, `.nvmrc`, `engines`) |
| npm | 11.19.1 |
| Next.js | 16.3.8 (Turbopack, konfiguracja domyślna) |
| React / React DOM | 19.2.8 |
| TypeScript | 5.9.3 |
| ESLint | 9.39.5 (`eslint-config-next` 16.3.8) |
| Vitest | 5.0.5 |
| server-only | 0.0.1 |
| Tailwind CSS / `@tailwindcss/postcss` | 4.3.3 / 4.3.3 (rozszerzenie) |
| PostCSS | 8.5.32 (rozszerzenie) |

Dokładne wersje przypina `package-lock.json`; zależności z Lab 06 nie były aktualizowane. Bez React Compiler,
bez Cache Components.

## Uruchomienie

```bash
npm ci
npm run lint
npm run test
npm run build
npm run start          # http://localhost:3000
```

Pozostałe skrypty:

```bash
npm run dev
npm run generate:data     # node scripts/generate-products.mjs [ziarno], domyślnie 2026
npm run generate:images   # odtwarza public/images/products/*.webp (sharp z Next.js)
```

## Trasy

| URL | Zawartość | Renderowanie (build) |
| --- | --- | --- |
| `/` | informacja o projekcie i autorze | statyczne |
| `/product-list` | katalog z filtrami i sortowaniem w adresie | dynamiczne (`searchParams`) |
| `/product-list/[id]` | szczegóły produktu | 10 najnowszych prerenderowanych, reszta przy pierwszym żądaniu |
| `/product-list/[id]/image` | ilustracja produktu (pełna strona) | dynamiczne |
| `/catalog/[[...slug]]` | kategorie i produkt w kategorii (rozszerzenie) | dynamiczne |
| `/basket`, `/order-history` | „… nie został(a) jeszcze zaimplementowany(a).” | statyczne |
| `/about` | informacja o sklepie i projekcie | statyczne |
| `/api/products` | read-only API (rozszerzenie Lab 06) | dynamiczne |
| inny URL | `app/not-found.tsx` z linkami powrotu, HTTP 404 | — |

## Kontrakt adresu katalogu

`/product-list?type=…&stock=…&sort=…` — adres jest jedynym źródłem stanu katalogu.

| Parametr | Wartości | Domyślnie |
| --- | --- | --- |
| `type` | `all`, `cpu`, `gpu`, `ram`, `disk` | `all` — wszystkie kategorie |
| `stock` | `all`, `available` (`amount > 0`), `unavailable` (`amount = 0`) | `all` |
| `sort` | `name` — klucz nazwy rosnąco (Lab 06), `newest` — data malejąco | `name` |

- Brak parametru → wartość domyślna, bez komunikatu.
- Nieznana, pusta albo powtórzona wartość rozpoznanego parametru → wartość domyślna i komunikat
  „Pominięto błędne ustawienie …”; pozostałe poprawne kryteria zostają. Wartości są wrażliwe na wielkość liter.
- Nieznane nazwy parametrów są ignorowane.
- Remisy: przy `name` równe klucze nazw, przy `newest` równe daty — rozstrzyga `id` rosnąco.

`lib/products/catalog-params.ts` zamienia obiekt `searchParams` (wartości: tekst, tablica tekstów albo
`undefined`) na ustawienia kontrolek i typowane `ProductCriteria`. Do repozytorium trafiają tylko zwalidowane
kryteria (`type: "all"` → brak ograniczenia kategorii), nigdy surowy obiekt z adresu.

Przykładowe adresy:

| Adres | Wynik |
| --- | --- |
| `/product-list?type=gpu&stock=available&sort=newest` | 17 dostępnych kart graficznych od najnowszej |
| `/product-list?type=ram&stock=unavailable` | 10 niedostępnych pamięci RAM, po nazwie |
| `/product-list?type=gpu&type=cpu&sort=newest` | wszystkie kategorie od najnowszych + komunikat o kategorii |
| `/product-list?stock=&sort=price` | domyślne ustawienia + dwa komunikaty |
| `/product-list?page=2&type=disk` | dyski; `page` zignorowany |

Kontrolki to formularz GET (`next/form`) z trzema `<select>` z etykietami, przyciskiem „Zastosuj” i linkiem
„Wyczyść filtry” (`/product-list`). Formularz wysyła wszystkie trzy pola, więc zmiana jednego filtra zachowuje
pozostałe. Ustawienia stosuje się jawnie przyciskiem; każde zastosowanie dodaje wpis historii (`push`), więc
Wstecz i Dalej przywracają poprzednie filtry — `replace` nie jest używane. Kontrolki są niekontrolowane
(`defaultValue`), a `key` formularza zależy od ustawień, więc po zmianie adresu (np. Wstecz) formularz montuje się
ponownie z wartościami z URL. Stan nie jest trzymany w `useState`, nie ma też `useSearchParams` — adres czyta
strona serwerowa.

## Szczegóły produktu

- `app/product-list/[id]/page.tsx` rozwiązuje `params` przez `await` i pokazuje nazwę, kod, kategorię, opis, cenę
  w złotych, stan magazynowy, datę (UTC) i obraz (`next/image`, `width`/`height`, `alt`).
- `parseProductId` (`lib/products/product-id.ts`) sprawdza cały tekst wzorcem `^[1-9][0-9]*$` (cyfry dziesiętne,
  bez znaku i zer wiodących), potem `Number.isSafeInteger` i zakres 1…2147483647 — dopiero wtedy pyta
  repozytorium. `parseInt("12abc")` dałby 12, dlatego nie jest używany.
- Błędny format, zakres albo `null` z repozytorium → `notFound()` → `app/product-list/[id]/not-found.tsx`
  („Nie znaleziono produktu” + link do katalogu). Produkt ze stanem 0 ma normalną stronę.
- Awaria repozytorium nie jest łapana — zostaje odrzuconym Promise i trafia do obsługi błędów (niżej).
- `generateMetadata` i strona używają `getProductForRoute` (`lib/products/product-page.ts`) — to samo repozytorium,
  owinięte w React `cache()`, więc w jednym żądaniu dane są czytane raz.
- Każda karta katalogu prowadzi przez `Link` do `/product-list/<id>`; strona produktu ma link „← Wróć do katalogu”,
  działający także po bezpośrednim wejściu (bez historii przeglądarki).

## Nawigacja i granica serwer–klient

- `NavLink` to jedyny komponent klienta w nawigacji: `usePathname()` + `linkRelation` (`lib/nav.ts`).
  Dokładne dopasowanie → `aria-current="page"`, strona wewnątrz sekcji (`/product-list/12`) → `aria-current="true"`.
  Dopasowanie sekcji kończy się na granicy segmentu (`/product-listing` nie jest sekcją katalogu), `/` dopasowuje
  się tylko dokładnie. Wyróżnienie: tło + podkreślenie, więc widać je bez najechania myszą.
- Widoczny fokus (`:focus-visible`), link „Przejdź do treści”, etykiety kontrolek, `role="status"` dla komunikatów.
- Layout ani katalog nie mają `use client`. Komponenty klienta: `NavLink`, `DescriptionToggle` (jeden string opisu),
  `ImageModal`, `LayoutStateDemo`, granice błędów. Strony serwerowe czytają repozytorium bezpośrednio — bez żądań
  do własnego API.

## Struktura

```
app/
  layout.tsx                       root layout: <html lang="pl">, metadane, nagłówek, nawigacja, stopka
  not-found.tsx                    główny widok 404
  product-list/
    layout.tsx                     okruszki, nota o cenach, sloty @featured i @modal
    error.tsx                      granica błędu sekcji (retry())
    (list)/page.tsx                katalog: searchParams → filtry → repozytorium
    (list)/loading.tsx             stan ładowania tylko listy (grupa tras nie zmienia URL)
    [id]/page.tsx                  szczegóły, generateMetadata, generateStaticParams
    [id]/not-found.tsx             „Nie znaleziono produktu”
    [id]/image/page.tsx            pełna strona ilustracji
    @featured/{page,default,error}.tsx       panel polecanych (Parallel Routes)
    @modal/{page,default}.tsx, @modal/[...catchAll]/page.tsx   pusty slot modala
    @modal/(.)[id]/image/page.tsx  modal ilustracji (Intercepting Routes)
  catalog/[[...slug]]/page.tsx     /catalog, /catalog/<typ>, /catalog/<typ>/<id>
  catalog/error.tsx
components/
  NavLink.tsx, SiteHeader.tsx, SiteFooter.tsx, LayoutStateDemo.tsx, DataErrorView.tsx
  products/  CatalogFilters, ProductList, ProductCard, ProductDetails, FeaturedPanel, ImageModal, DescriptionToggle
lib/
  nav.ts                           linkRelation (aktywna sekcja)
  format.ts                        cena w zł, data w UTC
  products/
    types.ts, validation.ts, query.ts, create-repository.ts, repository.ts (server-only)   — z Lab 06
    catalog-params.ts              kontrakt URL katalogu → ustawienia + ProductCriteria
    product-id.ts                  parseProductId, findProductByRouteId
    product-page.ts                getProductForRoute (cache, server-only)
    catalog-slug.ts                parseCatalogSlug (rozszerzenie)
    featured.ts                    3 polecane produkty (rozszerzenie)
    labels.ts                      polskie etykiety kontrolek
    criteria.ts                    parametry API (ścisłe, 400)
data/products.json                 100 produktów (wygenerowane, poza public/)
tests/                             testy Vitest
```

## Dane i kontrakt (Lab 06, bez zmian)

- `data/products.json` generuje `scripts/generate-products.mjs` (PRNG mulberry32, ziarno 2026); ponowne
  uruchomienie daje identyczny plik. 100 produktów: po 25 w kategoriach `cpu`, `gpu`, `ram`, `disk`, 30 z
  `amount = 0`, nazwy z polskimi znakami i różną wielkością liter, 7 par identycznych nazw z różnymi `id`,
  jedna nazwa w Unicode NFD (`id` 23).
- `price` to całkowite grosze; widok formatuje złote przez `Intl.NumberFormat("pl-PL", { currency: "PLN" })`.
- Walidator sprawdza tablicę, brak nieznanych pól, `id`/`price`/`amount` (`Number.isSafeInteger` + zakresy),
  `code` `^[A-Z0-9]{10}$`, unikalność `id` i `code`, niepuste `name`, poprawny Unicode bez U+0000, `type`, datę
  (format, lata 0001–9999, istnienie, `toISOString()`), lokalny `image`.
- Repozytorium: `getProducts(criteria)` → `Product[]` (pusty wynik `[]`), `getProductById(id)` → `Product | null`;
  awaria odrzuca Promise. `import "server-only"` — sprawdzone: import w komponencie klienta przerywa build.
- Sortowanie `name`: `name.normalize("NFC").toLowerCase().normalize("NFC")`, bajty UTF-8 przez `Buffer.compare`,
  remis → `id`. `newest`: czas malejąco, remis → `id`. Wejście nie jest mutowane.
- Próba zgodności z instrukcji Lab 06 daje według opisanej reguły `1, 2, 5, 3, 4, 6` (a nie `1…6`):
  „ALFA”, „alfa”, „Alfa” mają ten sam klucz, „łącznik” (bajty `C5 82`) jest po „zeta”. Fixture w `tests/fixtures.ts`.

## Testy (Vitest)

106 testów w 6 plikach:

- `catalog-params.test.ts` — poprawna kombinacja, brak wartości, nieznana wartość, wielkość liter, pusty tekst,
  powtórzony klucz (przykład z instrukcji), ignorowanie nieznanych nazw, brak mutacji, budowa linków.
- `product-id.test.ts` — `abc`, `12abc`, `0`, `-1`, `+1`, `01`, `1.0`, `1e3`, spacje, `2147483648`,
  `9007199254740993`, cyfry pełnej szerokości; istniejący produkt (też ze stanem 0), nieznane ID → `null`,
  brak zapytania dla błędnego ID, awaria repozytorium pozostaje odrzuceniem (nie `null`).
- `query.test.ts` — oba kierunki sortowania i remisy, fixture nazw, filtry, wszystkie trzy kryteria łącznie bez
  mutowania wejścia, pusta lista, `null` dla nieznanego ID, odrzucenie awarii źródła.
- `routing.test.ts` — aktywna sekcja nawigacji (granica segmentu, strona główna), `parseCatalogSlug`,
  deterministyczny wybór polecanych.
- `validation.test.ts`, `criteria.test.ts` — walidator danych i parametry API z Lab 06 (+ `type=all`).

## Wynik sprawdzeń (2026-10-27, Node 24.22.1, npm 11.19.1)

| Krok | Wynik |
| --- | --- |
| `npm ci` | OK |
| `npm run lint` | OK, bez ostrzeżeń |
| `npm run test` | OK, 6 plików, 106 testów |
| `npm run build` | OK; 19 stron; `/product-list/[id]` — 10 ścieżek SSG, reszta na żądanie |
| `npm run start` | scenariusze z tabeli 6.1 — niżej |

Scenariusze odbioru wykonałam na wersji produkcyjnej w przeglądarce (Chromium headless sterowany Playwright,
skrypt poza repozytorium; 47/47 sprawdzeń):

| Scenariusz | Wynik |
| --- | --- |
| Produkt dostępny (`/product-list/1`, 56 szt.) i ze stanem 0 (`/product-list/2`) | obie strony 200, poprawna cena, kod, stan i tytuł karty |
| `abc`, `12abc`, `0`, `-1`, `01`, `2147483648`, `9007199254740993`, nieznane `999` | widok „Nie znaleziono produktu”, HTTP 404 |
| `?type=gpu&stock=available&sort=newest` | 17 wyników, wszystkie GPU i dostępne, daty malejąco; kontrolki = adres |
| `?type=gpu&type=cpu&sort=newest`, `?stock=&sort=price` | wartości domyślne + komunikaty, pozostałe ustawienia zachowane |
| Formularz, Wstecz, Dalej, odświeżenie, „Wyczyść filtry” | zmiana jednego filtra zachowuje drugi; historia i odświeżenie odtwarzają wynik i kontrolki |
| Aktywna sekcja | lista: `Katalog` = `page`; szczegóły: `Katalog` = `true`; `/`: tylko `Start` |
| Wstecz ze szczegółów | wraca do `/product-list?type=gpu` z wybranym filtrem |
| Mały ekran (360 px) | brak poziomego przewijania na liście, szczegółach i `/catalog/gpu` |

**Pusty wynik:** w tym zbiorze danych nie ma kombinacji filtrów bez wyników — każda kategoria ma produkty dostępne
i niedostępne (sprawdzone dla wszystkich 15 kombinacji `type` × `stock`). Pusty stan (komunikat + „Wyczyść filtry”)
pokrywają testy repozytorium (`[]`) i kod `ProductList`; danych z Lab 06 nie zmieniałam.

### 404 a widok braku produktu

`notFound()` na stronie zagnieżdżonej daje w Next.js 16.3.8 odpowiedź **HTTP 404** z `<meta name="robots"
content="noindex">`, ale HTML jest pustą powłoką (`<html id="__next_error__">`) — widok z `[id]/not-found.tsx`
renderuje przeglądarka z payloadu RSC (sprawdzone minimalną trasą testową bez repozytorium: to samo zachowanie).
Gdy `loading.tsx` obejmował też `[id]`, odpowiedź miała **200**: granica Suspense wysyłała szkielet przed
`notFound()`, a statusu nie da się już zmienić. Dlatego `loading.tsx` jest w grupie `(list)` i dotyczy tylko listy.
Widok braku produktu i kod HTTP to więc dwie różne rzeczy.

### Narzędzia sieciowe: wejście bezpośrednie a `Link`

- Wejście bezpośrednie: żądanie typu `document`, `text/html`, status prawdziwy (`/product-list/2` → 200,
  `/product-list/abc` → 404).
- `Link` i formularz: brak nowego dokumentu, tylko `fetch` z `?_rsc=…` (`text/x-component`, payload RSC). Linki
  widoczne na ekranie są prefetchowane, więc kliknięcie w produkt często nie wysyła już żadnego żądania.

### Kontrolowane awarie (usunięte przed końcowym buildem)

Tymczasowo rzucałam wyjątek dla `id = 99` (poza zbiorem prerenderowanym) z tekstem zawierającym „secret”:

| Miejsce | HTTP | Widok | Log serwera |
| --- | --- | --- | --- |
| strona szczegółów | 500 | ogólna strona „Internal Server Error” | pełny komunikat, stos, `digest` |
| `generateMetadata` szczegółów | 500 | ogólna strona „Internal Server Error” | pełny komunikat, stos, `digest` |
| strona obrazu (render dynamiczny) | 500 | `error.tsx`: „Nie udało się wczytać danych produktów”, kod zgłoszenia, „Spróbuj ponownie”; nagłówek i panel polecanych zostają | pełny komunikat, `digest` |

W żadnym wariancie awaria nie udaje braku produktu, a słowo „secret” nie pojawia się w HTML ani w payloadzie.
Różnica widoku wynika z fazy renderowania: szczegóły spoza zbioru `generateStaticParams` są generowane przy
pierwszym żądaniu jako strona statyczna (ISR) — wyjątek przerywa generowanie, Next.js zwraca 500 i niczego nie
zapisuje w cache, a granice `error.tsx` działają tylko przy renderowaniu dynamicznym. Dla ścieżek prerenderowanych
taki wyjątek przerwałby `next build` — to błąd budowania, nie błąd obsługiwany przy żądaniu.

## Odpowiedzi na pytania — Lab 07

**Błędny format ID, brak produktu, awaria.** `12abc` to błąd adresu — wiadomo bez czytania danych, że produktu
nie ma (404). Poprawne `999`, którego repozytorium nie zna, to też 404, ale po zapytaniu (`null`). Awaria to
nieoczekiwany wyjątek przy odczycie — nie wiemy, czy produkt istnieje, więc zwracamy błąd (500 / `error.tsx`),
a nie „nie znaleziono”.

**Dlaczego `[id]` nie oznacza renderowania przy żądaniu?** Folder dynamiczny mówi tylko, że segment ma parametr.
Sposób renderowania wynika z kodu: `generateStaticParams` prerenderuje wybrane ID w czasie budowania, a pozostałe
(`dynamicParams = true`) są generowane przy pierwszym żądaniu i zapisywane. Dopiero użycie API żądania
(`searchParams`, `cookies`, `connection()`) wymusza renderowanie przy każdym żądaniu.

**Gdzie wykonują się odczyt i walidacja?** Na serwerze: w komponentach serwerowych (strona, `generateMetadata`)
i w funkcjach z `lib/`. Przeglądarka dostaje HTML i payload RSC z wynikiem, nie repozytorium ani walidator.

**Dlaczego walidujemy adres mimo kontrolek?** Adres można wpisać, skopiować, zmienić ręcznie albo dostać od
innego programu — kontrolki ograniczają tylko jedną drogę wejścia. Serwer nie może ufać żadnemu wejściu.

**Ten sam klucz dwa razy?** `searchParams.type` jest wtedy tablicą (`["gpu", "cpu"]`). Kontrakt traktuje to jako
błędne ustawienie: kategoria wraca do `all` i pojawia się komunikat (bez wybierania „pierwszej” wartości).

**Dlaczego filtr w `useState` nie odtwarza widoku z linku?** Stan komponentu żyje tylko w pamięci jednej karty;
nie ma go w URL, więc nowe wejście, odświeżenie albo udostępniony link zaczyna od wartości początkowej.

**Co zachowuje `Link`, a co pełne przeładowanie?** `Link` zostawia dokument, layouty powyżej zmienianego segmentu
i ich stan (licznik w stopce, panel polecanych); pobiera tylko payload RSC nowego segmentu. Pełne przeładowanie
tworzy nowy dokument i nowe drzewo React — stan klienta znika.

**Dlaczego komponent `use client` dostaje początkowy HTML z serwera?** `use client` wyznacza granicę bundla, nie
miejsce pierwszego renderu. Komponent klienta jest renderowany do HTML na serwerze, a w przeglądarce hydratowany.

**Czy wyróżnienie sekcji wymaga całego katalogu w przeglądarce?** Nie. `NavLink` dostaje tylko `href` i etykietę,
a ścieżkę czyta z `usePathname()`.

## Odpowiedzi na pytania — Lab 06

**`page.tsx` a `layout.tsx`.** `page.tsx` to treść jednej trasy i czyni segment publicznie dostępnym. `layout.tsx`
opakowuje stronę i zagnieżdżone segmenty; przy nawigacji między nimi zostaje zamontowany.

**Czy publiczna strona potrzebuje osobnego layoutu?** Nie — root layout obejmuje wszystkie strony. Jedyny
zagnieżdżony layout to `app/product-list/layout.tsx`: okruszki, nota o cenach i sloty wspólne dla listy i szczegółów.

**Gdzie wykonuje się funkcja repozytorium? Jakie dane trafiają do przeglądarki?** Tylko na serwerze
(`server-only`). Do przeglądarki trafia HTML i payload RSC; jako propsy komponentów klienta — tylko to, co im
przekazano (np. jeden opis dla `DescriptionToggle`).

**Dlaczego import całego JSON do komponentu klienta zmienia architekturę?** Plik trafiłby do bundla każdego
użytkownika, filtrowanie działałoby w przeglądarce, a dane byłyby zamrożone w chwili budowania. Zniknęłaby granica
repozytorium, więc w Lab 08 nie dałoby się podmienić JSON na bazę bez przebudowy widoków.

**Dlaczego brak funkcjonalności nie jest awarią?** Koszyk i historia to zaplanowany stan aplikacji; awaria to
nieoczekiwany błąd, który trzeba zalogować.

**Czy `error.tsx` przechwytuje błąd layoutu w tym samym segmencie?** Nie. `app/product-list/error.tsx` obejmuje
strony i segmenty wewnątrz layoutu katalogu, ale nie sam `app/product-list/layout.tsx`.

## Rozszerzenia

**Trasy równoległe — `@featured`.** Layout katalogu dostaje slot `featured` obok `children`: panel trzech
najnowszych dostępnych produktów (`getFeaturedProducts`, remis daty → `id`, więc wynik jest deterministyczny i
testowany). `@featured` to slot, nie segment URL — nie pojawia się w adresie, jest propem layoutu. `page.tsx` slotu
odpowiada `/product-list`; `default.tsx` renderuje ten sam panel po twardej nawigacji do `/product-list/<id>` i
`/image`, gdzie slot nie ma dopasowania (bez niego byłby 404). Przy nawigacji przez `Link` slot zachowuje aktywny
stan. `children` nie potrzebuje `default.tsx`: każda trasa sekcji ma własną stronę, a adres pasujący tylko do slotu
(np. `/product-list/1/2/3`) ma dać 404 — tak się dzieje. Slot ma własny `error.tsx`, więc awaria panelu nie zasłania
katalogu. Sprawdzone: lista, szczegóły przez `Link`, wejście bezpośrednie i odświeżenie.

**Modal obrazu — `@modal` + `(.)[id]/image`.** Kliknięcie obrazu w katalogu lub na stronie produktu zmienia adres
na `/product-list/<id>/image`, ale trasa przechwytująca `@modal/(.)[id]/image` pokazuje go w `<dialog>` nad
bieżącą stroną. `(.)` liczy poziomy segmentów od `product-list` (slot `@modal` się nie liczy). Wejście bezpośrednie
i odświeżenie tego adresu dają pełną stronę `[id]/image/page.tsx`; link do obrazu z `/catalog/…` (poza layoutem
katalogu, gdzie slot nie istnieje) też otwiera pełną stronę. Zamknięcie (Escape, „Zamknij”, kliknięcie tła)
wywołuje `router.back()`; Dalej otwiera modal ponownie. `showModal()` przenosi fokus do okna i trzyma go w środku;
po zamknięciu fokus wraca do linku obrazu. Pusty stan slotu: `default.tsx` (twarda nawigacja), `@modal/page.tsx`
(powrót do listy) i `@modal/[...catchAll]` (link z modala do szczegółów) — przy nawigacji klientowej
niedopasowany slot zachowałby otwarty modal, więc samo `default.tsx` nie wystarcza. Wszystko sprawdzone w
przeglądarce, w tym klawiatura.

**Segmenty wieloczęściowe — `/catalog/[[...slug]]`.** Osobna sekcja, `/product-list/[id]` bez zmian. `slug` to
tablica segmentów ścieżki: `/catalog` → `undefined` (lista kategorii), `/catalog/gpu` → `["gpu"]`,
`/catalog/gpu/12` → `["gpu","12"]` (produkt tylko, jeśli naprawdę jest GPU). Nieznana kategoria, błędne ID,
więcej niż dwa segmenty albo produkt z innej kategorii → 404. Wymagany `[...slug]` nie pasuje do samego
`/catalog` (404 bez osobnego `page.tsx`); opcjonalny `[[...slug]]` pasuje. W odróżnieniu od parametrów zapytania
segmenty są częścią ścieżki — mają kolejność i hierarchię (kategoria → produkt), a parametry zapytania to
niezależne, opcjonalne filtry tej samej strony.

**Prerenderowanie szczegółów — `generateStaticParams`.** Build prerenderuje 10 najnowszych produktów (`●` w wyniku
build: `/product-list/13`, `/30`, `/51`, … + 7). Pozostałe poprawne ID są renderowane przy pierwszym żądaniu i
zapisywane, nieznane dają 404. `dynamicParams = true`, bo przy `false` każdy istniejący produkt spoza zbioru dałby
404. Koszt: awaria przy generowaniu takiej strony to ogólne 500 zamiast `error.tsx` (sekcja awarii wyżej).
Przed Lab 08 (baza danych) trzeba to wyłączyć, żeby szczegóły czytały aktualne dane przy każdym żądaniu —
eksperyment nie przechodzi do dalszych laboratoriów.

**Tailwind CSS 4.** `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `postcss@8.5.32` (dokładne wersje),
wtyczka w `postcss.config.mjs`, `@import "tailwindcss";` w `app/globals.css`, kolory w `@theme` (`bg-paper`,
`text-ink`, `outline-focus`, …). Bez `tailwind.config.js` z `init -p` i bez dyrektyw `@tailwind`. Utility mają
formularz filtrów i szczegóły produktu; karty i reszta zostają w CSS / CSS Modules. Preflight zeruje nagłówki,
akapity i przyciski — rozsądne wartości przywracam w `@layer base`; reguły bez warstwy wygrywają z utility, więc
kolor linków i fokus też są w `base`. Zachowanie się nie zmieniło (te same 47 scenariuszy po zmianie); sprawdzone
etykiety, fokus z klawiatury i ekran 360 px.

**Rozszerzenia z Lab 06** (bez zmian): `GET /api/products` (teraz także `type=all`), stan ładowania listy
(`PRODUCT_REPOSITORY_DELAY_MS=1500 npm run start`), licznik w layoucie (`LayoutStateDemo`).

## Grafiki i źródła

- `public/images/products/{cpu,gpu,ram,disk}.webp` — własne grafiki zastępcze (`scripts/generate-images.mjs`).
- `public/images/politechnika-krakowska-logo.svg`, `app/favicon.ico`, `app/globals.css` (część bazowa) — materiały
  kursu; logo jest znakiem Politechniki Krakowskiej, użyte wyłącznie w projekcie dydaktycznym.
- Dokumentacja Next.js 16.3.8 (lokalnie `node_modules/next/dist/docs`): Dynamic Segments, `page` (`params`,
  `searchParams`, `PageProps`), `notFound`, `not-found`, `generateMetadata` (streaming metadata),
  `generateStaticParams`, `dynamicParams`, `Form`, `useRouter`, `usePathname`, Parallel Routes, `default`,
  Intercepting Routes, Route Groups, `error` (`retry`), `loading` (status codes), Linking and Navigating,
  Server and Client Components, Tailwind CSS z Next.js; React `cache`; MDN `<dialog>`; WAI-ARIA `aria-current`;
  Node.js `Buffer.compare`; Vitest; algorytm PRNG mulberry32.

## Ograniczenia

- **Next.js 16.3.8 ma znane podatności** (`npm audit`: m.in. GHSA-2464-fhr4-w9xw, krytyczna — Image Optimization API
  z plikami SVG). Poprawka jest w 16.4.x, ale wersję ustala prowadzący, więc jej nie zmieniałam. Projekt działa
  tylko lokalnie; nie wdrażać go publicznie w tej wersji.
- Awaria przy generowaniu szczegółów spoza zbioru prerenderowanego daje ogólną stronę 500 bez przycisku ponowienia
  (skutek rozszerzenia `generateStaticParams`).
- Widok 404 dla zagnieżdżonego `notFound()` renderuje przeglądarka (HTML z serwera jest pustą powłoką) — bez
  JavaScriptu użytkownik zobaczy pustą stronę ze statusem 404.
- Brak kombinacji filtrów z pustym wynikiem w danych — pusty stan pokrywają testy, nie scenariusz produkcyjny.
- JSON jest tylko do odczytu i trzymany w pamięci procesu; brak trwałości i spójności między procesami (Lab 08).
- Katalog pokazuje wszystkie wyniki bez paginacji; obrazy są wspólne dla kategorii (cztery pliki).
- Jasny tekst na tle `#8989e0` z arkusza kursu ma kontrast ok. 2,5:1 (poniżej 4,5:1 WCAG AA); treść katalogu
  i szczegółów jest na jasnych kartach z ciemnym tekstem.
- Scenariusze przeglądarkowe sprawdzałam skryptem Playwright spoza repozytorium; w repozytorium są testy Vitest.

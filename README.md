# Computer Shop 2026 — Lab 06

Autorka: Anastasiia Muzyka

Podstawa aplikacji sklepu komputerowego (Programowanie BackEnd, KIS M-7, PK): routing App Router,
wspólny layout, repozytorium produktów po stronie serwera z walidacją danych, obsługa pustego wyniku,
nieznanego adresu i awarii oraz trzy rozszerzenia (API, ładowanie, eksperyment z layoutem).

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

Dokładne wersje zależności przypina `package-lock.json`. Bez Tailwind, bez React Compiler, bez Cache Components.

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

| URL | Zawartość | Renderowanie |
| --- | --- | --- |
| `/` | informacja o projekcie i autorze | statyczne |
| `/product-list` | katalog (nazwa, kategoria, cena, dostępność), sortowanie po nazwie | dynamiczne (`connection()`) |
| `/basket` | „Koszyk nie został jeszcze zaimplementowany.” | statyczne |
| `/order-history` | „Historia nie została jeszcze zaimplementowana.” | statyczne |
| `/about` | informacja o sklepie i projekcie | statyczne |
| `/api/products` | read-only API (rozszerzenie) | dynamiczne |
| inny URL | `app/not-found.tsx` z linkami powrotu, HTTP 404 | — |

## Struktura

```
app/
  layout.tsx               root layout: <html lang="pl">, metadane, nagłówek, nawigacja, stopka
  page.tsx, about/, basket/, order-history/
  not-found.tsx            główny widok 404
  product-list/
    layout.tsx             layout sekcji katalogu (okruszki + nota o cenach) — wspólny z detalami w Lab 07
    page.tsx               Server Component, czyta repozytorium
    loading.tsx            stan ładowania (rozszerzenie)
    error.tsx              granica błędu (Client Component, retry())
  api/products/route.ts    GET /api/products (rozszerzenie)
components/
  SiteHeader.tsx, SiteFooter.tsx   komponenty serwerowe
  NavLink.tsx                      klient: usePathname() → aria-current / .active
  LayoutStateDemo.tsx              klient: licznik w layoucie (rozszerzenie)
  products/ProductList.tsx, ProductCard.tsx   komponenty serwerowe
  products/DescriptionToggle.tsx   klient: rozwijanie opisu (dostaje tylko jeden string)
lib/products/
  types.ts                 Product, ProductCriteria, ProductRepository, stałe kategorii
  validation.ts            walidacja rzeczywistych danych (czyste funkcje)
  query.ts                 klucz nazwy, filtrowanie i sortowanie (czyste funkcje)
  criteria.ts              parsowanie parametrów URL → ProductCriteria (API)
  create-repository.ts     repozytorium nad dowolnym asynchronicznym źródłem
  repository.ts            import "server-only"; źródło = data/products.json
data/products.json         100 produktów (wygenerowane, poza public/)
scripts/                   generator danych i obrazów
tests/                     testy Vitest
```

## Dane i kontrakt

- `data/products.json` generuje `scripts/generate-products.mjs` (PRNG mulberry32, ziarno 2026). Ponowne
  uruchomienie z tym samym ziarnem daje identyczny bajtowo plik (sprawdzone porównaniem skrótów).
- W danych: wszystkie kategorie (`cpu`, `gpu`, `ram`, `disk`, po 25), 30 produktów z `amount = 0` (co najmniej jeden
  w każdej kategorii), nazwy z polskimi znakami, nazwy pisane w całości wielkimi i małymi literami, 7 par
  identycznych nazw z różnymi `id` (np. 12 i 44, 6 i 98) oraz jedna nazwa zapisana w Unicode NFD (`id` 23).
- `price` to całkowite grosze; widok formatuje złote przez `Intl.NumberFormat("pl-PL", { currency: "PLN" })`.
- Walidator (`lib/products/validation.ts`) sprawdza: tablicę na wejściu, brak nieznanych pól, `id` / `price` /
  `amount` przez `Number.isSafeInteger` i zakresy z tabeli, `code` `^[A-Z0-9]{10}$`, unikalność `id` i `code`,
  niepuste `name` po `trim()`, poprawny Unicode (`isWellFormed()`) i brak U+0000 w tekstach, `type` z listy,
  datę (format, lata 0001–9999, rzeczywiste istnienie, `new Date(date).toISOString() === date`),
  `image` jako lokalny URL `/images/products/…`. Zwraca nowe, zamrożone obiekty albo rzuca `ProductValidationError`
  z listą wszystkich problemów.
- Repozytorium (`ProductRepository`): `getProducts(criteria)` z polami `type`, `stock` (`all` / `available` /
  `unavailable`) i `sort` (`name` / `newest`), `getProductById(id)` → `Product | null`. Pusty wynik to `[]`.
  Awaria źródła odrzuca Promise — repozytorium nie wywołuje `notFound()` i nie zamienia błędu na `null`/`[]`.
  Import `server-only` sprawdzony: tymczasowy import repozytorium w `DescriptionToggle.tsx` przerywa `next build`.
  Plik jest czytany raz i trzymany w pamięci procesu; nieudany odczyt nie jest cache'owany (retry czyta ponownie).
- Sortowanie `name`: klucz `name.normalize("NFC").toLowerCase().normalize("NFC")`, porównanie bajtów UTF-8
  przez `Buffer.compare`, remis → `id` rosnąco. `newest`: czas malejąco, remis → `id` rosnąco. Wejście nie jest mutowane.

### Uwaga o próbie zgodności z instrukcji

Dla par `(2,"ALFA") (1,"alfa") (3,"Beta") (4,"Zeta") (5,"Alfa") (6,"Łącznik")` instrukcja podaje kolejność
`1, 2, 3, 4, 5, 6`. Zgodnie z opisaną regułą wynik to jednak **`1, 2, 5, 3, 4, 6`**: „ALFA”, „alfa” i „Alfa”
mają ten sam klucz `alfa`, więc remis rozstrzyga `id` (1, 2, 5); „łącznik” zaczyna się bajtami `C5 82`, czyli
po ASCII „zeta”. Testy sprawdzają kolejność wynikającą z reguły (z dodanymi „Ą” i „Ą”:
`1, 2, 5, 3, 4, 7, 8, 6`) — fixture w `tests/fixtures.ts`, do ponownego użycia przy adapterze bazy w Lab 08.

## Testy (Vitest)

`tests/query.test.ts`, `tests/validation.test.ts`, `tests/criteria.test.ts` — 51 testów:
oba kierunki sortowania i remisy, fixture nazw bez mutowania wejścia (zamrożone obiekty), filtry dostępności
i kategorii, pusta lista, `null` dla nieznanego ID, odrzucenie awarii źródła; walidator odrzuca duplikat `id`
i `code`, ujemną cenę, 2147483648 w `id`/`price`/`amount`, niepoprawne daty (30 lutego, brak milisekund,
strefa inna niż UTC, rok 0000, format akceptowany przez `Date.parse`), U+0000 i samotne surogaty;
plik `data/products.json` przechodzi walidację i spełnia wymagania zbioru; parametry API.

## Wynik sprawdzeń (2026-10-26, Node 24.22.1, npm 11.19.1)

| Krok | Wynik |
| --- | --- |
| `npm ci` | OK (po uzupełnieniu `package-lock.json` o brakujące `@emnapi/core` i `@emnapi/runtime` 1.11.3) |
| `npm run lint` | OK, bez ostrzeżeń |
| `npm run test` | OK, 3 pliki, 51 testów |
| `npm run build` | OK; `/product-list` i `/api/products` dynamiczne, pozostałe statyczne |
| `npm run start` | `/`, `/product-list`, `/basket`, `/order-history`, `/about` → 200; `/nope` → 404 z własnym widokiem |
| API | `?type=cpu&stock=unavailable&sort=newest` → 200; `?type=psu&x=1` → 400 z listą błędów; poprawne zapytanie bez wyników → 200 `[]` |

### Eksperyment z awarią

Tymczasowo dodałem `throw new Error("… (secret detail)")` w `app/product-list/page.tsx`, zbudowałem wersję
produkcyjną i otworzyłem `/product-list`, potem usunąłem wymuszenie i zbudowałem ponownie.

- Log serwera: pełny komunikat i stos wywołań oraz `digest: '2099649742'`.
- Przeglądarka: widok z `error.tsx` („Nie udało się wczytać katalogu”, kod zgłoszenia = digest, przycisk
  „Spróbuj ponownie” wywołujący `retry()`); w HTML nie było treści komunikatu — tylko digest.
- Status HTTP to **200**, bo `loading.tsx` tworzy granicę Suspense: szkielet strony został wysłany strumieniowo,
  zanim błąd wystąpił, więc nagłówka nie można już zmienić.
- Strona katalogu wywołuje `connection()`, więc renderuje się przy żądaniu. Bez tego Next.js prerenderowałby ją
  podczas `next build`, a wymuszony wyjątek przerwałby build — to byłby błąd budowania, a nie test granicy błędu
  obsługiwanej przy żądaniu.

## Odpowiedzi na pytania

**`page.tsx` a `layout.tsx`.** `page.tsx` to unikalna treść jednej trasy i czyni segment publicznie dostępnym.
`layout.tsx` opakowuje stronę i wszystkie zagnieżdżone segmenty (`children`); przy nawigacji między nimi zostaje
zamontowany i nie renderuje się ponownie.

**Czy publiczna strona potrzebuje osobnego layoutu?** Nie. Root layout obejmuje wszystkie strony. Dodałem tylko
`app/product-list/layout.tsx`, bo zawiera elementy wspólne dla listy i przyszłych szczegółów produktu
(`/product-list/[id]` w Lab 07): okruszki z powrotem do katalogu i notę o cenach brutto.

**Co pozostaje wspólne przy nawigacji przez `Link`?** Layouty powyżej zmienianego segmentu (nagłówek, nawigacja,
stopka, layout katalogu) i ich stan po stronie klienta. Wymieniany jest tylko segment strony; `Link` prefetchuje
trasę i nie przeładowuje dokumentu.

**Gdzie wykonuje się funkcja repozytorium?** Tylko na serwerze — w Server Component `/product-list` i w Route
Handlerze. `repository.ts` importuje `server-only`, więc import do komponentu klienta kończy się błędem budowania.

**Jakie dane trafiają do przeglądarki?** Wyrenderowany HTML i payload RSC z wynikiem renderowania. Jako propsy
komponentów klienta trafia tylko to, co im przekazano: `DescriptionToggle` dostaje jeden string z opisem. Nie trafia
plik JSON, moduł repozytorium ani walidator.

**Dlaczego import całego JSON do komponentu klienta zmienia architekturę?** Plik trafiłby do bundla JavaScript
pobieranego przez każdego użytkownika (rozmiar, ujawnienie wszystkich danych), filtrowanie odbywałoby się w
przeglądarce, a dane byłyby zamrożone w chwili budowania. Zniknęłaby granica repozytorium, więc w Lab 08 nie dałoby
się podmienić JSON na bazę bez przebudowy widoków.

**Czy `use client` wyklucza początkowe renderowanie HTML na serwerze?** Nie. Komponent klienta jest prerenderowany
do HTML na serwerze, a w przeglądarce dostaje hydratację. `use client` wyznacza granicę: kod komponentu i jego
importy trafiają także do bundla klienta.

**Dlaczego brak funkcjonalności nie jest awarią?** Koszyk i historia to zaplanowany, przewidywalny stan aplikacji;
strona działa poprawnie i mówi o tym użytkownikowi. Awaria to nieoczekiwany błąd, który należy zalogować; pusty
katalog to po prostu `[]` i zwykły komunikat w widoku.

**Czy `error.tsx` przechwytuje błąd layoutu w tym samym segmencie?** Nie. `error.tsx` opakowuje `page`,
`loading`, `not-found` i zagnieżdżone layouty, ale nie `layout.tsx` tego samego segmentu. Błąd w
`app/product-list/layout.tsx` obsłużyłaby granica wyżej (`app/error.tsx` lub `global-error.tsx` dla root layoutu).

**Dlaczego widok „nie znaleziono” nie zawsze oznacza HTTP 404?** W odpowiedzi strumieniowej status i nagłówki są
wysyłane z pierwszym fragmentem. Jeśli `notFound()` zostanie wywołane, gdy część strony (np. szkielet z
`loading.tsx`) już została wysłana, status 200 jest już ustalony — Next.js pokazuje widok 404 i dodaje
`<meta name="robots" content="noindex">`. Nieznany URL bez dopasowanej trasy daje prawdziwe 404 (sprawdzone).

## Rozszerzenia

**Read-only API — `GET /api/products`.** Parametry: `type` = `cpu|gpu|ram|disk`, `stock` = `all|available|unavailable`
(domyślnie `all`), `sort` = `name|newest` (domyślnie `name`). Nieznany parametr, powtórzony parametr lub niepoprawna
wartość → 400 `{ error, details[] }`. Poprawne zapytanie bez wyników → 200 `[]`. Awaria repozytorium → 500 z
ogólnym komunikatem (szczegóły tylko w logu). Strona i Route Handler korzystają z tego samego `productRepository`;
strona nie wysyła żądania HTTP do własnego API.

**Ładowanie.** `app/product-list/loading.tsx` + opcjonalne opóźnienie repozytorium ze zmiennej środowiskowej:

```bash
PRODUCT_REPOSITORY_DELAY_MS=1500 npm run start      # PowerShell: $env:PRODUCT_REPOSITORY_DELAY_MS=1500; npm run start
```

W produkcji `Link` prefetchuje szkielet `loading.tsx` dynamicznej trasy, więc po kliknięciu stan ładowania pojawia
się natychmiast, a katalog dociera strumieniowo. W developmencie trasa jest kompilowana przy pierwszym wejściu i
prefetch nie działa, więc pierwsze przejście trwa dłużej, a stan ładowania bywa widoczny także bez opóźnienia.

**Eksperyment z layoutem.** W stopce (root layout) jest licznik `LayoutStateDemo` (`useState`). Po kilku kliknięciach
i przejściu między stronami przez `Link` wartość zostaje, bo root layout nie jest odmontowywany — React podmienia
tylko segment strony. Po pełnym przeładowaniu (F5 lub wpisanie adresu) licznik wraca do 0: przeglądarka ładuje nowy
dokument, a stan istniał tylko w pamięci poprzedniego drzewa React.

## Dostępność i wygląd

`lang="pl"`, metadane z szablonem tytułu, jeden `h1` na stronę, `nav` z `aria-label`, `aria-current="page"` w
nawigacji, link „Przejdź do treści”, przyciski jako `<button>` z `aria-expanded`, komunikaty stanu z `role="status"`
/ `role="alert"`, siatka kart zawija się na małym ekranie. Style: `app/globals.css` (arkusz z materiałów kursu) +
CSS Module dla kart produktów.

## Grafiki i źródła

- `public/images/products/{cpu,gpu,ram,disk}.webp` — własne grafiki zastępcze wygenerowane skryptem
  `scripts/generate-images.mjs`; do dowolnego użytku w projekcie.
- `public/images/politechnika-krakowska-logo.svg`, `app/favicon.ico`, `app/globals.css` — materiały przekazane w
  ramach kursu; logo jest znakiem Politechniki Krakowskiej, użyte wyłącznie w projekcie dydaktycznym.
- Dokumentacja: Next.js 16 (lokalnie `node_modules/next/dist/docs`): Project Structure, Layouts and Pages,
  Linking and Navigating, Server and Client Components, Fetching Data, Error Handling, `error.js`, `not-found.js`,
  `connection`, Route Handlers, Image; Node.js `Buffer.compare`; Vitest (vitest.dev); `server-only` (npm);
  algorytm PRNG mulberry32.

## Ograniczenia

- JSON jest tylko do odczytu i trzymany w pamięci procesu; zmiana pliku wymaga restartu serwera. Brak trwałości
  i spójności między procesami — to zadanie bazy w Lab 08.
- Katalog renderuje wszystkie 100 produktów bez paginacji; filtry w interfejsie i szczegóły produktu będą w Lab 07.
- `error.tsx` jest tylko w sekcji katalogu; błąd w layoucie katalogu lub root layoucie nie ma własnej granicy.
- Obrazy są wspólne dla kategorii (cztery pliki), a nie dla produktów.
- `npm audit` zgłasza 5 ostrzeżeń „high” w zależnościach deweloperskich szablonu; nie wymuszałem
  `npm audit fix --force`, bo zmieniłby przypięte wersje.
- Kolorystyka pochodzi z arkusza kursu; jasny tekst na tle `#8989e0` ma kontrast ok. 2,5:1, poniżej zalecanego
  4,5:1 (WCAG AA).

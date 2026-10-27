# Computer Shop 2026 — Lab 08

Autorka: Anastasiia Muzyka

Sklep komputerowy (Programowanie BackEnd, KIS M-7, PK). Lab 06 dał podstawę (routing, layout, repozytorium,
walidację danych, obsługę pustego wyniku, 404 i awarii), Lab 07 — szczegóły produktu i filtry w adresie.
**Lab 08 zastępuje plik JSON bazą PostgreSQL 17 obsługiwaną przez Prisma ORM 7**: migracje z własnym SQL,
powtarzalny seed w transakcji, repozytorium Prisma z tym samym kontraktem, trwały zapis, testy integracyjne na
osobnej bazie oraz wszystkie cztery rozszerzenia (koszyk, historia zamówień, indeksy, zapis współbieżny).

## Wersje

| Element | Wersja |
| --- | --- |
| Node.js / npm | 24.22.1 (`.nvmrc`, `engines`) / 11.19.1 |
| Next.js / React | 16.3.8 (Turbopack, konfiguracja domyślna) / 19.2.8 |
| TypeScript / ESLint / Vitest | 5.9.3 / 9.39.5 / 5.0.5 |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | **7.10.1** (ta sama poprawka, `--save-exact`) |
| `pg` / `@types/pg` / `dotenv` / `tsx` | 8.23.1 / 8.23.1 / 18.0.9 / 4.23.15 |
| Tailwind CSS (rozszerzenie Lab 07) | 4.3.3 |
| Obraz bazy | `postgres:17` → PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2), digest `sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe` |
| Docker Engine / Compose | 29.9.2 / v5.6.1 |

Wszystkie wersje przypina `package-lock.json`. Prisma 8 jest nadal RC (`npm view prisma dist-tags` → `latest:
8.0.0-rc.27`), dlatego instalacja bez numeru pobrałaby wersję 8 — instalowałam jawnie `@7.10.1` (Listing 2.1 z
pełnym numerem). CLI uruchamiam lokalnie (`npx --no-install prisma …` albo skrypty npm), bez pobierania przez
`npx`. `package.json` ma `"type": "module"`; konfiguracje (`next.config.ts`, `eslint.config.mjs`,
`postcss.config.mjs`, `vitest.config.mts`, skrypty `.mjs`) były już ESM, `tsconfig` zostaje przy `module:
esnext` + `moduleResolution: bundler`.

## Uruchomienie od zera

```bash
cp .env.example .env              # ustaw własne hasło (te same dane w POSTGRES_* i w URL-ach)
npm ci
docker compose up -d --wait       # czeka na healthcheck pg_isready (npm run db:up)
npx --no-install prisma migrate deploy    # zapisane migracje (npm run db:migrate)
npx --no-install prisma generate          # klient do lib/generated/prisma (npm run prisma:generate)
npx --no-install prisma db seed           # 4 kategorie, 100 produktów + dane rozszerzeń (npm run db:seed)
npm run lint
npm run test                      # testy jednostkowe + integracyjne (baza testowa shop_test)
npm run build
npm run start                     # http://localhost:3000
```

Klient Prisma nie jest w repozytorium (`lib/generated/` w `.gitignore`) — odtwarza go `prisma generate`.
`generate` czyta `prisma.config.ts`, więc wymaga zmiennej `DATABASE_URL` (z `.env`), choć nie łączy się z bazą.
`next build` nie łączy się z bazą — wszystkie strony z danymi renderują się przy żądaniu.

Pozostałe skrypty: `npm run test:unit`, `npm run test:integration`, `npm run db:set-amount -- <id> <stan>`,
`npm run db:explain`, `npm run db:race`, `npm run dev`, `npm run generate:data`, `npm run generate:images`.

Polecenia kontenera (Listing 3.1): `docker compose ps`, `docker compose logs postgres`, `docker compose stop
postgres`, `docker compose start postgres`. **`docker compose down -v` usuwa wolumen z danymi** — to nie jest
restart.

### `migrate dev` a `migrate deploy`

- `prisma migrate dev` — tylko lokalnie, przy pracy nad schematem: porównuje schemat z historią, tworzy nową
  migrację (`--create-only` pozwala dopisać SQL przed zastosowaniem), stosuje ją i może poprosić o reset przy
  rozjeździe. Tak powstały wszystkie trzy migracje.
- `prisma migrate deploy` — stosuje wyłącznie zapisane, niezastosowane migracje, nic nie generuje i nie resetuje.
  Tego używa się na wspólnej/produkcyjnej bazie; używają go też testy integracyjne na pustej bazie.
- `migrate reset` usuwa dane — nie jest sposobem na naprawę konfliktów. Zastosowanych migracji nie edytuję.

## Zmienne środowiskowe (`.env.example`)

| Zmienna | Znaczenie |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | baza, użytkownik i hasło tworzone przez obraz przy **pierwszej** inicjalizacji wolumenu (zmiana hasła w `.env` później nie zmienia istniejącego użytkownika) |
| `POSTGRES_PORT` | port na hoście (`127.0.0.1:<port>:5432`); przy zajętym 5432 zmień go i URL-e |
| `DATABASE_URL` | połączenie aplikacji, CLI Prisma i skryptów: `postgresql://user:hasło@localhost:5432/shop`; tylko serwer — bez `NEXT_PUBLIC_`; znaki specjalne hasła kodowane procentowo |
| `TEST_DATABASE_URL` | osobna baza testów integracyjnych (`…/shop_test`); nazwa musi kończyć się na `_test` i różnić od `DATABASE_URL` |

`compose.yaml` bierze `POSTGRES_*` z tego samego `.env` (interpolacja `${…:?}` przerywa start bez wartości), więc
kontener i URL-e korzystają z jednego zestawu danych. `.env` jest ignorowany przez Git; w repozytorium jest tylko
`.env.example` z wartościami zastępczymi.

## Lokalna baza — `compose.yaml`

Usługa `postgres` z obrazu `postgres:17`, port opublikowany wyłącznie na `127.0.0.1`, nazwany wolumen
`postgres-data` → `/var/lib/postgresql/data` (układ obrazu 17), `healthcheck` przez
`pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`. Bez przestarzałego pola `version` i bez konfiguracji nasłuchiwania.
`docker compose up -d --wait` kończy się dopiero, gdy kontener jest `healthy`, więc migracje nie startują przed
gotowością bazy.

## Prisma — konfiguracja i klient

- `prisma.config.ts` (CLI): schemat, katalog migracji, seed `tsx prisma/seed.ts`, `datasource.url =
  env("DATABASE_URL")`; `.env` ładuje jawnie `import "dotenv/config"`.
- `prisma/schema.prisma`: generator `prisma-client` z `output = "../lib/generated/prisma"`, `datasource db` tylko z
  `provider = "postgresql"` (URL jest w konfiguracji CLI).
- `lib/prisma-client.ts`: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`, import z
  `@/lib/generated/prisma/client` (nie z `@prisma/client`). Bez `server-only`, żeby mogły go użyć skrypty.
- `lib/db.ts` (`import "server-only"`): **jedna instancja klienta na proces**, trzymana na `globalThis`, więc
  przeładowania modułów w developmencie nie tworzą nowych pul połączeń. Tworzona przy pierwszym odczycie.
  Aplikacja nie wywołuje `$disconnect()` przy odczytach.
- Seed, skrypty i testy tworzą własnego klienta i zamykają go w `finally`; nie importują modułów `server-only`.

## Model danych

```
Category 1 ──< Product                      (rozszerzenia)
  id  SERIAL PK                              User 1 ── 0..1 Cart 1 ──< CartItem >── 1 Product
  code TEXT UNIQUE (cpu|gpu|ram|disk)        User 1 ──< Order 1 ──< OrderItem >── 0..1 Product
  name TEXT
```

| Kolumna `Product` | Typ PostgreSQL | Ograniczenia / uwagi |
| --- | --- | --- |
| `id` | `INTEGER` PK, bez autoincrement | `CHECK (id > 0)`; ID z JSON, więc URL-e `/product-list/<id>` się nie zmieniają |
| `code` | `VARCHAR(10)` | `UNIQUE` (jedyny indeks na `code`), `CHECK (code ~ '^[A-Z0-9]{10}$')` |
| `name` | `TEXT` | `CHECK (name ~ '[^[:space:]]')` — niepusta po pominięciu białych znaków; oryginał do wyświetlania |
| `nameSortKey` | `TEXT COLLATE "C"` | `name.normalize("NFC").toLowerCase().normalize("NFC")` (wspólna funkcja `nameSortKey` z Lab 06) |
| `description`, `image` | `TEXT` | treść i lokalne URL-e obrazów z Lab 06 (pliki zostają w `public/`) |
| `price` | `INTEGER` (int4) | grosze, `CHECK (price >= 0)`; górną granicę 2147483647 daje sam typ |
| `amount` | `INTEGER` (int4) | sztuki, `CHECK (amount >= 0)` |
| `date` | `TIMESTAMPTZ(3)` | źródłowa data UTC z milisekundami; sortowanie `newest` |
| `categoryId` | `INTEGER` FK → `Category.id` | `ON DELETE RESTRICT` — kategorii z produktami nie da się usunąć; indeks `Product_categoryId_idx` |

`Category.code` ma `UNIQUE` i `CHECK (code ~ '^[a-z]+$')`. Bez `createdAt`/`updatedAt` w katalogu — sortowanie
`newest` zawsze używa `date`.

**Migracje** (`prisma/migrations`): `…_catalog`, `…_cart`, `…_orders`. Każda powstała przez
`migrate dev --create-only`, potem dopisałam SQL, którego schemat Prisma 7 nie wyraża (`CHECK`, `COLLATE "C"`),
i dopiero wtedy ją zastosowałam. Dzięki temu ograniczenia odtwarzają się z samej historii — także na pustej bazie
i przez `migrate deploy` (sprawdzają to testy). `prisma migrate diff --from-config-datasource --to-schema` daje
pustą migrację: Prisma nie traktuje `CHECK`/`COLLATE` jako rozjazdu.

**Indeksy:** klucze główne, `UNIQUE` na `Category.code`, `Product.code`, `User.email`, `Cart.userId`,
`Order.number`, `CartItem(cartId, productId)`, oraz indeks na `Product.categoryId` (filtr `?type=` i sprawdzanie
klucza obcego przy usuwaniu kategorii). Złożone indeksy pod sortowanie zbadałam w rozszerzeniu i świadomie ich nie
dodałam (niżej).

## Seed

`npx --no-install prisma db seed` → `prisma/seed.ts`:

1. Czyta `data/products.json` i **waliduje cały plik** walidatorem z Lab 06 (`validateProducts`) — błąd w
   dowolnym rekordzie kończy seed przed jakimkolwiek zapisem.
2. W **jednej transakcji** robi `upsert` 4 kategorii (klucz `code`) i 100 produktów (klucz `id`) z zachowaniem
   ID, kodów, cen, stanów i dat; `nameSortKey` liczy wspólna funkcja `nameSortKey` (`productColumns`). Błąd zapisu
   cofa całą transakcję — nie zostaje częściowy katalog.
3. W osobnej transakcji tworzy dane rozszerzeń (użytkownik, koszyk, zamówienia).
4. Błąd → komunikat, `process.exitCode = 1`, połączenie zamykane w `finally`.

Co seed aktualizuje: 4 kategorie i produkty o ID z pliku (wszystkie kolumny, także `amount` — seed przywraca stan
demonstracyjny). Innych wierszy nie usuwa ani nie zmienia; nie czyści tabel. Zamówień już istniejących nie
nadpisuje (to historia). Plik JSON jest teraz źródłem importu i testów, nie źródłem odczytu sklepu.

**Wynik dwukrotnego seeda** (lokalna baza `shop`):

| | Po 1. seedzie | Po 2. seedzie |
| --- | --- | --- |
| Kategorie / produkty / unikalne kody | 4 / 100 / 100 | 4 / 100 / 100 |
| Suma kontrolna wszystkich wierszy (md5 id, kod, nazwa, klucz, cena, stan, data, kategoria) | `730f89a2e12535d6c474408802a96edb` | `730f89a2e12535d6c474408802a96edb` |
| ID kategorii | `cpu:1, gpu:2, ram:3, disk:4` | bez zmian |
| Przykład: produkt 1 / 2 / 23 | `HY2KBCWNEG` 92500 gr, 56 szt., `2025-07-21T07:44:03.353Z` / `71KJOKX4K7` 672900 gr, 0 szt. / `AQ18VQ4P1P` 57199 gr | identycznie, zgodnie z JSON |
| Dane rozszerzeń | 1 użytkownik, 1 koszyk, 2 pozycje, 4 zamówienia (utworzone 4) | to samo (utworzone 0) |

## Repozytorium i zachowanie sklepu

`lib/products/prisma-repository.ts` implementuje ten sam `ProductRepository` co adapter pamięciowy z Lab 06
(`create-repository.ts`, zostaje do testów porównawczych):

- `getProducts(criteria)` buduje `where` i `orderBy` ze zwalidowanych kryteriów (`type` → `category.code`,
  `stock` → `amount > 0` / `= 0`) — filtruje i sortuje baza, bez wczytywania całej tabeli.
- Kolejność: `name` → `[{ nameSortKey: "asc" }, { id: "asc" }]`, `newest` → `[{ date: "desc" }, { id: "asc" }]`.
  `COLLATE "C"` porównuje bajty UTF-8, tak jak `Buffer.compare` w Lab 06; domyślne reguły bazy nie mają wpływu.
- `getProductById(id)` odrzuca ID spoza 1…2147483647 (i nie-całkowite) **przed zapytaniem** → `null`; nieznane
  ID → `null`.
- Widok dostaje model domenowy: `type` z kodu kategorii, `price` w groszach, `date` przez `toISOString()`;
  `nameSortKey` i `categoryId` zostają w repozytorium.
- Awaria bazy odrzuca Promise — nigdy `[]` ani `null`. Nie ma powrotu do pliku JSON.
- `lib/products/repository.ts` (`server-only`) łączy adapter ze wspólnym klientem; strony, `generateMetadata`
  i `GET /api/products` używają tylko jego.

### Porównanie kolejności adapterów

Test `tests/integration/repository.test.ts`:

- Pełny zbiór 100 produktów, **wszystkie 30 kombinacji** `type` (5) × `stock` (3) × `sort` (2): wynik Prisma ===
  wynik adaptera pamięciowego z Lab 06 (te same obiekty, ta sama kolejność) — **30/30 zgodnych**.
- Fixture z Lab 06 (`ALFA`, `alfa`, `Beta`, `Zeta`, `Alfa`, `Łącznik`, `Ą` U+0104, `Ą` A+U+0328): oba adaptery
  dają `1, 2, 5, 3, 4, 7, 8, 6`; oryginalne nazwy (obie postaci Unicode) zostają.
- Kontrola: sortowanie po `name COLLATE "pl-PL-x-icu"` daje inną kolejność — wynik nie zależy od reguł
  porównywania tekstu w bazie, tylko od klucza i `COLLATE "C"`.
- Remisy dat → `id` rosnąco; data zachowuje milisekundy, także dla `0001-01-01T00:00:00.000Z` i
  `9999-12-31T23:59:59.999Z`.

### Polityka renderowania

| Trasa | Polityka |
| --- | --- |
| `/product-list` (lista) | `await connection()` przed odczytem — każde żądanie czyta aktualną bazę |
| `/product-list/[id]` (szczegóły) | `await connection()` w stronie |
| `generateMetadata` szczegółów | `await connection()` — tytuł z tego samego odczytu (`getProductForRoute`, React `cache()`) |
| `/product-list/[id]/image`, modal, panel `@featured`, `/catalog/…` | `await connection()` |
| `/`, `/about`, `/basket`, `/order-history` | statyczne (bez danych z bazy) |

`connection()` jest w stronach i komponentach, a nie w repozytorium, bo repozytorium wykorzystują też seed, skrypty
i testy poza żądaniem. Usunęłam `generateStaticParams`/`dynamicParams` z rozszerzenia Lab 07 — prerenderowane
strony pokazywałyby dane z chwili budowania. Bez buforowania. `next build` pokazuje wszystkie trasy z danymi
jako `ƒ (Dynamic)`.

## Trwały zapis

`scripts/set-amount.ts` (`npm run db:set-amount -- <id> <stan>`) — lokalny skrypt, nie formularz ani API:
waliduje ID (`parseProductId`) i stan (całkowity 0…2147483647), w transakcji wymaga **dokładnie jednego**
zmienionego wiersza. `--skip-validation` pomija walidację aplikacji, żeby pokazać, że bazę chroni `CHECK`.

| Krok | Wynik |
| --- | --- |
| `npm run db:set-amount -- 1 0` | `Product 1: amount 56 → 0.` |
| `… -- 1 -5` | `Stock update rejected: Invalid amount -5: an integer 0..2147483647 is required.` (kod 1) |
| `… -- 1 -5 --skip-validation` | `… violates check constraint "product_amount_nonnegative"` (kod 1) |
| `… -- 999 3` | `Expected exactly one changed product, got 0 (id 999).` (kod 1) |

**Sprawdzenie trwałości** (wersja produkcyjna, przeglądarka): produkt 1 (`cpu`), stan 56 → 0.

| Moment | Karta na liście | `?stock=available` | `?stock=unavailable` | Szczegóły — wejście bezpośrednie | Szczegóły — przez `Link` |
| --- | --- | --- | --- | --- | --- |
| przed zmianą | „Dostępny (56 szt.)” | jest | brak | „Dostępny — 56 szt.” | jw. |
| po zmianie (bez restartu) | „Niedostępny” | brak | jest | „Niedostępny — 0 szt.” | jw. |
| po restarcie aplikacji i `docker compose stop/start postgres`, **bez seeda** | „Niedostępny” | brak | jest | „Niedostępny — 0 szt.” | jw. |

Stan przetrwał restart procesu Next.js i kontenera, bo jest zapisany w wolumenie bazy, a nie w zaimportowanej
tablicy. Potem przywróciłam 56 tym samym skryptem.

**Niedostępna baza** (`docker compose stop postgres`, aplikacja działa): `/product-list`, filtry, `/product-list/1`,
`/product-list/1/image`, `/catalog/gpu` → HTTP 500 i widok `error.tsx` „Nie udało się wczytać danych produktów”
z kodem zgłoszenia i „Spróbuj ponownie”; nigdzie pusty katalog ani „Nie znaleziono produktu”. `GET
/api/products` → 500 `{"error":"Internal server error"}`. Log serwera: `ECONNREFUSED` + `digest`. Po
`docker compose up -d --wait` przycisk „Spróbuj ponownie” przywraca listę, szczegóły i panel polecanych.

Przy tym teście znalazłam i poprawiłam błąd z Lab 07: awaria panelu `@featured` renderowanego przez
`default.tsx` trafiała do `error.tsx` katalogu (Next.js obejmuje nim każdy slot layoutu), więc na stronie produktu
pojawiały się dwa pełne widoki błędu. Teraz panel ma własną granicę (`FeaturedBoundary`) wewnątrz slotu i pokazuje
krótkie „Nie udało się wczytać polecanych produktów”.

## Testy

`npm run test` = projekt `unit` (106 testów, 6 plików — bez bazy) + projekt `integration` (103 testy, 6 plików).

Testy integracyjne (`tests/integration`) działają na **osobnej bazie `shop_test`** w tym samym kontenerze:

- `global-setup.ts` sprawdza, że `TEST_DATABASE_URL` kończy się na `_test` i nie jest `DATABASE_URL`, usuwa
  i tworzy bazę testową od nowa, a schemat buduje wyłącznie z historii migracji (`prisma migrate deploy`).
- Przed każdym czyszczeniem (`TRUNCATE … RESTART IDENTITY`) `resetDatabase` pyta połączenie o
  `current_database()` i odmawia, jeśli to nie jest baza testowa.

| Plik | Co sprawdza |
| --- | --- |
| `migrations.test.ts` | wszystkie migracje zastosowane na pustej bazie, `COLLATE "C"`, komplet 14 `CHECK`, jeden indeks na `code`, strażnik nazwy bazy |
| `seed.test.ts` | 4 + 100 rekordów zgodnych z JSON; drugi seed = identyczny katalog; seed przywraca zmienione dane i nie rusza obcych wierszy; błędny plik → zero zapisów; konflikt w połowie importu → pełne wycofanie |
| `repository.test.ts` | 30 kombinacji zgodnych z adapterem z Lab 06, fixture nazw, niezależność od collation bazy, remisy, filtry łącznie, `[]`, model domenowy, milisekundy i daty graniczne, `null` dla nieznanego ID, ID spoza zakresu bez zapytania, awaria bazy → odrzucony Promise |
| `constraints.test.ts` | surowym SQL (bez walidatora): ujemna cena i stan, `2147483648` w `id`/`price`/`amount`, `id = 0`, duplikat kodu i ID, zły format kodu, pusta nazwa, nieistniejąca kategoria, usunięcie kategorii z produktami; to samo przez Prisma Client |
| `stock.test.ts` | `setProductAmount`: zapis widoczny z nowego połączenia, odrzucenie ujemnych/niecałkowitych/za dużych, wymóg jednego wiersza; `reserveStock`: wyścigi o ostatnią sztukę |
| `cart-orders.test.ts` | rozszerzenia: unikalny koszyk, para koszyk–produkt, `CHECK 1..99`, kaskada pozycji, unikalny e-mail, 4 zamówienia z dokładnymi sumami, snapshot ceny, `SetNull` po usunięciu produktu, blokada usunięcia użytkownika z zamówieniami, `CHECK` pozycji zamówienia |

## Wynik sprawdzeń (2026-10-27)

| Krok | Wynik |
| --- | --- |
| `npm ci` → `prisma generate` | OK, `Generated Prisma Client (7.10.1) to ./lib/generated/prisma` |
| `npm run lint` | OK, bez ostrzeżeń |
| `npm run test` | OK — 209 testów (106 unit + 103 integracyjne), 12 plików |
| `npm run build` | OK; trasy z danymi `ƒ`, build nie łączy się z bazą |
| `npm run start` + przeglądarka (Playwright, skrypt poza repozytorium) | 47/47 scenariuszy z Lab 07 bez zmian na bazie (filtry, kolejność, 404, modal, Wstecz/Dalej), trwałość i awaria bazy jak wyżej |
| Bundle przeglądarki (`.next/static`) | 0 wystąpień `PrismaClient`, `@prisma/adapter-pg`, `DATABASE_URL`, hasła, `nameSortKey` |
| Import `lib/db.ts` w komponencie klienta (eksperyment, cofnięty) | build przerwany: „You're importing a module that depends on server-only” |

## Odpowiedzi na pytania — Lab 08

**Kontener, wolumen, baza.** Kontener to uruchomiony proces serwera PostgreSQL z obrazu — można go zatrzymać,
usunąć i utworzyć ponownie. Wolumen to katalog danych (`/var/lib/postgresql/data`) żyjący niezależnie od
kontenera; dlatego `stop`/`start` (a nawet nowy kontener) zachowują dane, a `down -v` je kasuje. Baza (`shop`,
`shop_test`) to logiczny zbiór tabel wewnątrz jednego serwera, zapisany w wolumenie.

**`localhost` na hoście i w kontenerze.** `localhost` zawsze oznacza „ten sam system sieciowy”. Na hoście to
Mac, gdzie Docker publikuje port `127.0.0.1:5432`. Wewnątrz kontenera to sam kontener — inny kontener aplikacji
nie znalazłby tam bazy; w sieci Compose używa się nazwy usługi `postgres`.

**Co potwierdza test gotowości?** `pg_isready` mówi, że serwer przyjmuje połączenia do danej bazy jako dany
użytkownik. Nie sprawdza hasła, uprawnień, istnienia tabel ani migracji, ani tego, że aplikacja się połączy —
to potwierdzają migracje i testy.

**Konfiguracja CLI, generator, adapter.** `prisma.config.ts` mówi CLI, gdzie jest schemat, migracje i seed oraz
jakiego URL-a użyć do `migrate`/`db seed`. Generator (`prisma-client`) zamienia schemat na typowany kod klienta w
`lib/generated/prisma`. Adapter `PrismaPg` to warstwa uruchomieniowa: klient wysyła zapytania przez sterownik
`pg` z pulą połączeń do `DATABASE_URL`. Każda część działa w innym momencie (CLI, generowanie, działanie aplikacji).

**Dlaczego typy klienta nie potwierdzają danych od użytkownika?** Typy TypeScript istnieją tylko podczas
kompilacji. Dane z adresu, formularza czy pliku JSON przychodzą w czasie działania jako dowolny tekst; typ `Int`
nie sprawdza zakresu, znaku, formatu kodu ani istnienia kategorii. Dlatego są walidatory w aplikacji i `CHECK`/`UNIQUE`/FK w bazie.

**Jak sprawdzić, że moduł bazy nie trafia do przeglądarki?** `lib/db.ts` i `repository.ts` mają `import
"server-only"` — import w komponencie klienta przerywa build (sprawdzone). Dodatkowo przeszukałam bundle
przeglądarki: brak Prisma, adaptera, `DATABASE_URL` i hasła.

**Migracja, generowanie klienta, seed.** Migracja zmienia strukturę bazy (tabele, ograniczenia) i jest zapisana
w historii. Generowanie tworzy kod klienta z `schema.prisma` — nie dotyka bazy. Seed wpisuje dane
demonstracyjne do istniejącej struktury. Każde trzeba uruchomić osobno; migracja nie uruchamia seeda.

**Powtarzalność seeda.** Ten sam plik na tej samej bazie daje ten sam wynik niezależnie od liczby uruchomień:
stabilne klucze (`id`, `code`) i `upsert` zamiast `create`, brak duplikatów i brak zależności od stanu (poza
świadomie zachowaną historią zamówień).

**Dlaczego transakcja nie zastępuje walidacji całego pliku?** Transakcja gwarantuje „wszystko albo nic”, ale nie
wie, czy dane są poprawne: zły format kodu, nazwa z U+0000 czy błędna data przeszłyby, jeśli baza ich nie
blokuje, a część błędów wyszłaby dopiero w połowie importu. Walidacja całego pliku przed zapisem zatrzymuje błąd
od razu i podaje wszystkie problemy.

**Co zostaje kontraktem repozytorium po zmianie adaptera?** Asynchroniczne `getProducts(criteria)` →
`Product[]` (pusty wynik `[]`), `getProductById(id)` → `Product | null`, typy `ProductCriteria`/`Product` (cena w
groszach, `date` jako ISO z milisekundami, `type` jako kod kategorii), kolejność z remisami po `id` i
odrzucony Promise przy awarii. Widoki nie zmieniły się wcale.

**Które ograniczenia działają przy zapisie poza aplikacją?** Te w bazie: `PRIMARY KEY`, `UNIQUE`, klucze obce z
`RESTRICT`/`CASCADE`/`SET NULL`, `CHECK`, `NOT NULL`, typy (`int4`, `varchar(10)`, `timestamptz`). Działają
także dla `psql`, skryptów i innych aplikacji. Walidator aplikacji działa tylko wtedy, gdy zapis przez nią
przechodzi.

**Dlaczego poprawny zapis nie gwarantuje, że buforowana strona go pokaże?** Strona z bufora (prerender, ISR, cache
danych, router cache przeglądarki) to kopia z wcześniejszej chwili — dopóki nie zostanie unieważniona lub
wygenerowana ponownie, pokazuje stare dane. Dlatego podstawa nie ma buforowania, a strony czytają bazę przy
każdym żądaniu (`connection()`).

## Rozszerzenia Lab 08

### Model koszyka (migracja `…_cart`)

`User` zgodny z Better Auth: `id String`, `name`, unikalny `email`, `emailVerified` (domyślnie `false`),
opcjonalne `image`, `createdAt`, `updatedAt`; bez kolumny hasła (Better Auth trzyma dane logowania w `Account` —
Lab 09). `Cart.userId` jest `UNIQUE` (jeden koszyk na użytkownika), `CartItem` ma `UNIQUE (cartId, productId)`,
`ON DELETE CASCADE` od koszyka (usunięcie koszyka usuwa pozycje) i od produktu (koszyk nie jest historią),
`CHECK (quantity BETWEEN 1 AND 99)` w nowej migracji SQL. Seed: fikcyjne konto `demo@computer-shop.test`
(`id = demo-user`) i koszyk z 2 pozycjami. Bez logowania i publicznych operacji.

### Historia zamówień (migracja `…_orders`)

`Order`: unikalny `number` (`CHECK '^ZAM-[0-9]{4}-[0-9]{4}$'`), jawny `enum OrderStatus` (`PENDING`, `PAID`,
`SHIPPED`, `DELIVERED`, `CANCELLED`), `userId` z `ON DELETE RESTRICT`, `total BIGINT`, `placedAt TIMESTAMPTZ(3)`.
`OrderItem`: snapshot `productCode`, `productName`, `unitPrice INTEGER` (grosze), `quantity`, `lineTotal BIGINT`
z `CHECK ("lineTotal" = "unitPrice"::BIGINT * "quantity")`, `CHECK quantity > 0`, `CHECK unitPrice >= 0`.
Wybrałam **opcjonalną relację z `SET NULL` i pełny snapshot**: usunięcie produktu zeruje `productId`, a pozycja
zostaje z kodem, nazwą i ceną (`Restrict` blokowałby usuwanie produktu, a nie chronił historii). Sumy w `int8`:
`2147483647 × 99 = 212 600 881 053` groszy mieści się bez straty (test).

Seed tworzy 4 deterministyczne zamówienia (`ZAM-2026-0001…0004`) tylko wtedy, gdy numeru jeszcze nie ma, więc
kolejne seedy nie nadpisują historii:

| Numer | Status | Pozycje (kod × ilość @ cena) | Suma (gr) |
| --- | --- | --- | --- |
| ZAM-2026-0001 | DELIVERED | 9SSSVZ8ON0 ×1 @84899; 4680G8Q8HL ×2 @523700 | 1132299 |
| ZAM-2026-0002 | SHIPPED | ADSSCDD7RG ×1 @50099 | 50099 |
| ZAM-2026-0003 | PAID | 5KUOTCVMZ9 ×1 @343200; 71KJOKX4K7 ×1 @672900 | 1016100 |
| ZAM-2026-0004 | CANCELLED | RX4COEN2OO ×3 @276699 | 830097 |

Test: zmiana ceny produktu 13 na 1 gr + ponowny seed → zamówienie `ZAM-2026-0001` identyczne; usunięcie
produktu 94 → pozycja zostaje z `productId = null`.

### Indeksy i zapytania (`npm run db:explain`)

Skrypt tworzy osobną bazę `shop_bench`, stosuje migracje, generuje deterministycznie 200 000 produktów i uruchamia
`EXPLAIN (ANALYZE, BUFFERS)` na **dokładnym SQL wysyłanym przez repozytorium** (przechwyconym z logu zapytań
Prisma), bez i z indeksami `("categoryId", "nameSortKey", id)` oraz `("categoryId", date DESC, id)`.
Zapytanie katalogu: `gpu` + `available` + sortowanie.

| Zapytanie (200 000 wierszy) | Przed: plan, bufory, czas | Po dodaniu indeksów |
| --- | --- | --- |
| filtr relacji `category.code` (repozytorium), `name`, cała lista | Seq Scan `Category` → Bitmap `Product_categoryId_idx` → Sort; 4298; ~24 ms | **bez zmian** — indeks nieużyty |
| filtr relacji, `newest`, cała lista | jw.; ~21 ms | bez zmian |
| filtr relacji, `name`, pierwsze 24 | Limit → Sort (top-N); ~15 ms | bez zmian |
| `categoryId = 2` (znane ID), `name`, cała lista | Bitmap + Sort; 4297; ~22 ms | bez zmian (~1/6 tabeli — bitmapa + sort tańsze) |
| `categoryId = 2`, `name`, pierwsze 24 | Bitmap + Sort; 4297; 12.2 ms | **Index Scan** `…nameSortKey_id_idx`; 41; **0.03 ms** |
| `categoryId = 2`, `newest`, pierwsze 24 | Bitmap + Sort; 4297; 12.2 ms | **Index Scan** `…date_id_idx`; 39; **0.03 ms** |
| wstawienie 20 000 wierszy | 169 ms | 262 ms (+55 %) |
| rozmiar | tabela 33 MB | +17 MB i +8 MB indeksów |

Wnioski: filtr relacji Prisma (`category: { code }`) to `JOIN` z `Category`, w którym ID kategorii nie jest znane
przy planowaniu — złożony indeks zaczynający się od `categoryId` nie jest wtedy używany. Indeks pomaga dopiero
przy znanym `categoryId` i `LIMIT` (paginacja). Katalog zwraca całe listy bez paginacji, a przy 100 rekordach
planer słusznie wybiera Seq Scan (9 buforów, ~0.1 ms). Dlatego **nie dodałam** tych indeksów do migracji — kosztują
zapis i ~75 % rozmiaru tabeli, a obecnym zapytaniom nic nie dają. Gdy pojawi się paginacja, repozytorium powinno
filtrować po `categoryId` (4 stałe kategorie) i wtedy warto dodać oba indeksy nową migracją.

### Zapis współbieżny (`npm run db:race`)

`reserveStock` (`lib/products/stock.ts`) to jedno warunkowe `UPDATE … SET amount = amount - q WHERE id = $1 AND
amount >= q` (`updateMany` + `count === 1`). Blokada wiersza przy `UPDATE` sprawia, że druga transakcja czeka i po
zatwierdzeniu pierwszej ponownie sprawdza warunek (READ COMMITTED) — nie potrzeba osobnego odczytu ani ponawiania.
Skrypt działa na osobnej bazie `shop_race` z dwoma klientami (dwie pule połączeń):

```
Atomic conditional UPDATE: exactly one success and amount 0 in 50/50 rounds.
Naive read-then-write: 2 successes for 1 unit, amount 0 — the last unit was sold twice (lost update).
```

Test integracyjny dodatkowo: 12 równoległych prób z 4 połączeń przy stanie 3 → dokładnie 3 sukcesy, stan 0.
Przy użyciu w checkoutcie (Lab 09) całą transakcję zamówienia trzeba przetestować ponownie.

## Trasy (stan po Lab 08)

| URL | Zawartość | Renderowanie |
| --- | --- | --- |
| `/` | informacja o projekcie i autorze | statyczne |
| `/product-list` | katalog z filtrami i sortowaniem w adresie (`?type`, `?stock`, `?sort`) | dynamiczne |
| `/product-list/[id]` | szczegóły produktu | dynamiczne |
| `/product-list/[id]/image` | ilustracja (pełna strona; z katalogu — modal) | dynamiczne |
| `/catalog/[[...slug]]` | kategorie i produkt w kategorii | dynamiczne |
| `/basket`, `/order-history` | „… nie został(a) jeszcze zaimplementowany(a).” | statyczne |
| `/about` | informacja o sklepie i projekcie | statyczne |
| `/api/products` | read-only API, 400 dla błędnych parametrów, 500 przy awarii | dynamiczne |

Kontrakt adresu katalogu z Lab 07 bez zmian: `type` = `all|cpu|gpu|ram|disk`, `stock` =
`all|available|unavailable`, `sort` = `name|newest`; brak → domyślna, wartość nieznana/pusta/powtórzona →
domyślna + komunikat, nieznane nazwy ignorowane, remisy po `id`. ID produktu: `^[1-9][0-9]*$`, bezpieczna liczba
całkowita 1…2147483647, inaczej `notFound()`.

## Struktura (nowe w Lab 08)

```
compose.yaml                        PostgreSQL 17, wolumen, healthcheck
.env.example                        wymagane zmienne (wartości zastępcze)
prisma.config.ts                    konfiguracja CLI Prisma
prisma/
  schema.prisma                     Category, Product (+ User, Cart, CartItem, Order, OrderItem)
  migrations/…_catalog|_cart|_orders/migration.sql    wygenerowany SQL + własne CHECK / COLLATE "C"
  seed.ts, seed-catalog.ts, seed-demo.ts              seed (walidacja, transakcje, upsert)
lib/
  prisma-client.ts                  createPrismaClient (adapter PrismaPg)
  db.ts                             wspólny klient aplikacji (server-only, globalThis)
  generated/prisma/                 klient Prisma (generowany, poza Git)
  products/prisma-repository.ts     adapter PostgreSQL repozytorium
  products/repository.ts            repozytorium aplikacji (server-only)
  products/stock.ts                 setProductAmount, reserveStock
scripts/
  set-amount.ts, explain-catalog.ts, reserve-race.ts
tests/integration/                  testy na bazie shop_test
components/products/FeaturedBoundary.tsx   granica błędu panelu @featured
```

## Źródła

- Prisma ORM 7 (`prisma.io/docs/orm/v7`): status wydań, zmiany w Prisma 7 (generator `prisma-client`,
  `prisma.config.ts`, adaptery sterowników), Config API, PostgreSQL + `@prisma/adapter-pg`, zarządzanie
  połączeniami, własny SQL w migracjach (`--create-only`), funkcje poza schematem, seeding, transakcje,
  filtrowanie i sortowanie, relacje, akcje referencyjne, `migrate dev` / `migrate deploy` / `migrate diff`.
- PostgreSQL 17: ograniczenia (`CHECK`, `UNIQUE`, klucze obce), collation `"C"`, typy liczbowe, `EXPLAIN`,
  izolacja transakcji (READ COMMITTED), wersje.
- Oficjalny obraz `postgres` (Docker Hub): zmienne `POSTGRES_*`, `/var/lib/postgresql/data`; Docker Compose:
  `healthcheck`, `up --wait`, interpolacja zmiennych.
- Next.js 16.3.8 (lokalnie `node_modules/next/dist/docs`): `connection`, `error` (`retry`), Parallel Routes,
  `default`, Route Handlers; Better Auth — schemat tabeli `user`.
- Z poprzednich laboratoriów: Dynamic Segments, `page`/`params`/`searchParams`, `notFound`, `generateMetadata`,
  Intercepting Routes, Tailwind CSS 4, Node.js `Buffer.compare`, Vitest, mulberry32.

## Ograniczenia

- **Next.js 16.3.8 ma znane podatności** (`npm audit`, m.in. krytyczna GHSA-2464-fhr4-w9xw). Wersję ustala
  prowadzący, więc jej nie zmieniałam; projekt działa tylko lokalnie.
- Testy integracyjne i `prisma db seed` wymagają działającego kontenera i `.env`; `npm run test` bez bazy kończy
  się błędem w części integracyjnej (część `unit` działa: `npm run test:unit`).
- Seed nadpisuje stan produktów z pliku — po demonstracji trwałości trzeba pamiętać, że `db seed` przywraca
  wartości z JSON.
- `CHECK` na nazwie używa klasy `[:space:]` PostgreSQL; walidator aplikacji (`trim()`) zna więcej znaków
  odstępu Unicode, więc ostateczną regułę „niepusta nazwa” wymusza walidator.
- Katalog bez paginacji; złożone indeksy pod sortowanie zostaną dodane razem z nią (rozszerzenie „Indeksy”).
- Koszyk i zamówienia mają tylko model i dane demonstracyjne — bez logowania i widoków (Lab 09).
- Scenariusze przeglądarkowe sprawdzałam skryptem Playwright spoza repozytorium.

<details>
<summary>Lab 07 — szczegóły rozwiązania i odpowiedzi (archiwum)</summary>

- **Filtry:** formularz GET (`next/form`) z trzema `<select>`, przyciskiem „Zastosuj” i linkiem „Wyczyść filtry”;
  każde zastosowanie dodaje wpis historii (`push`), `key` formularza zależy od ustawień, więc kontrolki zawsze
  odpowiadają adresowi. Stan nie jest w `useState`.
- **Szczegóły:** `parseProductId` (cały tekst, bez zer wiodących, zakres) przed repozytorium; `null` →
  `notFound()` → `[id]/not-found.tsx`; awaria → `error.tsx`. `generateMetadata` i strona dzielą odczyt przez
  React `cache()`.
- **404 a status:** zagnieżdżone `notFound()` daje HTTP 404 z pustą powłoką HTML — widok renderuje przeglądarka;
  `loading.tsx` jest w grupie `(list)`, żeby szczegóły nie streamowały statusu 200.
- **Nawigacja:** `NavLink` + `usePathname()`; dokładne dopasowanie → `aria-current="page"`, sekcja →
  `aria-current="true"`, granica segmentu, `/` dokładnie.
- **Rozszerzenia Lab 07:** `@featured` (Parallel Routes), modal obrazu (`@modal` + `(.)[id]/image`),
  `/catalog/[[...slug]]`, Tailwind CSS 4; `generateStaticParams` usunięte w Lab 08.
- **Odpowiedzi:** błędny format ID / brak produktu / awaria to odpowiednio 404 bez zapytania, 404 po zapytaniu i
  500; folder `[id]` nie przesądza o renderowaniu przy żądaniu (decyduje użycie API żądania lub
  `generateStaticParams`); walidujemy adres, bo można go wpisać ręcznie; powtórzony klucz to tablica → wartość
  domyślna + komunikat; filtr w `useState` nie trafia do URL; `Link` zachowuje layouty i ich stan, pełne
  przeładowanie nie; `use client` nie wyklucza HTML z serwera; wyróżnienie sekcji nie wymaga danych katalogu.

</details>

<details>
<summary>Lab 06 — dane, kontrakt i odpowiedzi (archiwum)</summary>

- `data/products.json` generuje `scripts/generate-products.mjs` (mulberry32, ziarno 2026): 100 produktów, po 25
  w kategorii, 30 ze stanem 0, polskie znaki, różna wielkość liter, 7 par identycznych nazw, jedna nazwa w NFD.
- Walidator: tablica, brak nieznanych pól, `Number.isSafeInteger` i zakresy, kod `^[A-Z0-9]{10}$`, unikalność `id`
  i `code`, niepusta nazwa, poprawny Unicode bez U+0000, typ, data (format, 0001–9999, istnienie,
  `toISOString()`), lokalny obraz.
- Próba zgodności sortowania z instrukcji daje według reguły `1, 2, 5, 3, 4, 6` („ALFA”/„alfa”/„Alfa” mają ten
  sam klucz; „łącznik” `C5 82` jest po „zeta”).
- **Odpowiedzi:** `page.tsx` to treść trasy, `layout.tsx` ją opakowuje i zostaje zamontowany; publiczna strona nie
  potrzebuje osobnego layoutu; repozytorium działa tylko na serwerze (`server-only`), do przeglądarki trafia HTML
  i payload RSC; import JSON do klienta wrzuciłby dane do bundla i zniósł granicę repozytorium; brak funkcji to
  zaplanowany stan, nie awaria; `error.tsx` nie łapie błędu layoutu tego samego segmentu.

</details>

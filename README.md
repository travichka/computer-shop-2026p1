# Computer Shop 2026 — Lab 10

Autorka: Anastasiia Muzyka

Sklep komputerowy (Programowanie BackEnd, KIS M-7, PK). Lab 06–09: katalog, filtry, PostgreSQL 17 + Prisma 7,
logowanie GitHub OAuth (Better Auth) i własny koszyk. **Lab 10 wdraża tę aplikację na Vercel pod stabilnym
adresem HTTPS ze zdalnym PostgreSQL 17 (Neon)**, z kontrolowanymi migracjami, CI w GitHub Actions, publikacją
konkretnego, sprawdzonego commitu i testem odbiorczym. Opis Lab 09 i Lab 08 — niżej, bez zmian.

> Pola oznaczone ⟨…⟩ uzupełnia się po faktycznym wdrożeniu (adres, SHA, czasy odbioru). Wyniki lokalne
> i CI w tej sekcji są rzeczywiste; wyników z Production nie wpisuję, zanim odbiór nie zostanie wykonany.

## Lab 10 — podsumowanie oddania

| Pozycja | Wartość |
| --- | --- |
| Stabilny adres Production | ⟨`https://computer-shop-2026p1.vercel.app`⟩ |
| Gałąź Production | `main` (Vercel → Settings → Environments → Production branch) |
| SHA odebranej wersji | ⟨SHA commitu `main` po scaleniu PR — ten sam, który pokazuje `/api/version` i stopka⟩ |
| PR `lab10 → main` | ⟨link do PR⟩ (gałąź `lab10` zachowana) |
| Region aplikacji / bazy | Vercel `fra1` (Frankfurt, `vercel.json`) / Neon `aws-eu-central-1` (Frankfurt) |
| Wykonane rozszerzenia | CI/CD, test przeglądarkowy koszyka, backup i restore, pomiar wydajności; odrębne środowisko testowe — procedura przygotowana (zob. Rozszerzenia) |

## Lab 10 — wersje środowiska

| Element | Wersja |
| --- | --- |
| Node.js | **24.x** (`engines.node`, Vercel; `node-version: 24` w CI), lokalnie 24.22.1, npm 11.19.1 |
| Next.js / React | 16.3.8 / 19.2.8, backend w **Node.js Runtime** (route handlery mają `runtime = "nodejs"`) |
| Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | 7.10.1, generator `prisma-client` → `lib/generated/prisma` |
| `pg` | 8.23.1 (pula przez `PrismaPg`) |
| Better Auth | 1.7.7 |
| `@vercel/functions` | 3.10.3 (`attachDatabasePool`) |
| `@playwright/test` | 1.64.1 (Chromium) |
| PostgreSQL | 17 — lokalnie 17.11 (`postgres:17`), CI `postgres:17`, Production: Neon PostgreSQL 17 ⟨wersja z `npm run db:check`⟩ |

## Lab 10 — plan publikacji

Kolejność każdego wydania: **testy → migracje → publikacja → odbiór**.

| Etap | Jak | Automatyczny czy operator |
| --- | --- | --- |
| Testy | `.github/workflows/ci.yml`: `npm ci` → `prisma generate` → `lint` → `test` (unit + integracja na odtwarzanej bazie) → `build` → migracje + seed na pustej bazie CI → `next start` + `npm run smoke` → Playwright | automatycznie przy każdym push/PR |
| Migracje | `.github/workflows/migrate.yml` (ręczne uruchomienie, wpisanie `production`) albo z terminala operatora, zob. niżej | **operator** — świadoma czynność na wspólnej bazie |
| Bramka migracji | `release.yml`, job `migrations-applied`: `prisma migrate status` na Production; oczekujące migracje zatrzymują wydanie | automatycznie |
| Publikacja | `release.yml`, job `deploy` (tylko `main`, `needs` = zielone CI + bramka): `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` | automatycznie po zatwierdzeniu PR i scaleniu |
| Odbiór | automatycznie `npm run smoke -- <domena> --expect-sha <SHA>`; scenariusze z dwoma kontami GitHub — ręcznie (tabela niżej) | automat + operator |

Własne wdrożenia Git integracji Vercel są wyłączone (`vercel.json`: `"git": { "deploymentEnabled": false }`),
więc **jedyną drogą na Production jest `release.yml`** — zielone GitHub Actions jest tu rzeczywistą zależnością
publikacji, a nie tylko informacją. Projekt Vercel jest nadal połączony z repozytorium GitHub (podgląd commitów).
Awaryjnie operator może opublikować sprawdzony commit ręcznie: `npx vercel@65.9.0 deploy --prod` z czystego
checkoutu tego SHA, a potem zapisać SHA tutaj.

Przebieg PR: `lab10` → PR do `main` → CI zielone → zatwierdzenie → (jeżeli PR zawiera nową migrację: operator
uruchamia „Migrate production database” na `main` po scaleniu; do tego czasu bramka nie wpuszcza wydania) →
`release.yml` publikuje wynikowy commit `main` → odbiór → SHA do README. Poprawka po odbiorze = nowy commit/PR
i ponowny odbiór nowego SHA.

## Lab 10 — środowiska i konfiguracja (bez sekretów)

| | Development | Preview | Production |
| --- | --- | --- | --- |
| Adres | `http://localhost:3000` | **wyłączone** (`deploymentEnabled: false`) | stabilna domena HTTPS |
| Baza | kontener `postgres:17` (`compose.yaml`) | — | Neon, gałąź `main`, baza `shop` |
| Rola aplikacji | `shop` (lokalna) | — | `shop_app` (tylko DML), endpoint **pooled** |
| Rola migracji | ta sama | — | właściciel bazy (DDL), endpoint **direct** — tylko w zadaniu migracji |
| OAuth App GitHub | osobna, callback `http://localhost:3000/api/auth/callback/github` | — | osobna, callback `https://<domena>/api/auth/callback/github` |
| Sekrety | `.env` (nie w repozytorium) | — | Vercel → Environment Variables → *Production*; GitHub → Environment `production` |

Zmienne (wzór z opisem: `.env.example`; żadna nie ma prefiksu `NEXT_PUBLIC_`):

| Zmienna | Gdzie | Przeznaczenie |
| --- | --- | --- |
| `DATABASE_URL` | Vercel Production | `postgresql://shop_app:…@ep-…-pooler.eu-central-1.aws.neon.tech/shop?sslmode=verify-full` — runtime aplikacji i `prisma generate` w buildzie |
| `DATABASE_POOL_MAX` | Vercel Production (opcjonalnie) | rozmiar puli pg na jedną instancję, domyślnie 5 |
| `BETTER_AUTH_URL` | Vercel Production | stabilna domena (sam origin, `https://`) |
| `BETTER_AUTH_SECRET` | Vercel Production | osobny losowy sekret (`openssl rand -base64 32`), inny niż lokalny |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Vercel Production | produkcyjna OAuth App |
| `MIGRATION_DATABASE_URL` | GitHub Environment `production` (secret) | direct URL właściciela; w zadaniu migracji przekazywany **pod nazwą `DATABASE_URL` tylko temu procesowi** — zmienna aplikacji w Vercel nie jest nadpisywana |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Actions secrets | publikacja z `release.yml` |
| `PRODUCTION_URL` | GitHub Environment `production` (variable) | adres do testu odbiorczego |

Zmiana zmiennej w Vercel dotyczy tylko nowych wdrożeń — po zmianie: ponowne uruchomienie `release.yml`
(Actions → Release → Run workflow) i odbiór.

Zabezpieczenia konfiguracji w kodzie:

- `lib/auth-options.ts`: na Vercel (`VERCEL_ENV` = `production`/`preview`) `BETTER_AUTH_URL` musi być `https://`,
  nie `localhost` i bez ścieżki — inaczej start kończy się jawnym błędem zamiast cichej awarii logowania.
  `trustedOrigins` = dokładnie origin `BETTER_AUTH_URL`, bez wzorców typu `*.vercel.app`. Cookie sesji:
  przy `https` Better Auth ustawia `__Secure-…`, `HttpOnly`, `SameSite=Lax`; cookie cache wyłączony
  (każde żądanie sprawdza wiersz `Session`).
- `next.config.ts` nie zawiera sekretów — wpisuje tylko publiczny SHA commitu buildu (`APP_COMMIT_SHA`), widoczny
  w `/api/version` i w stopce.

## Lab 10 — wdrożenie od zera (procedura operatora)

**1. Repozytorium.** Repozytorium osobiste prywatne (`travichka/computer-shop-2026p1`) — Hobby obsługuje
prywatne repozytoria kont osobistych, więc nie trzeba niczego upubliczniać. Sekrety nigdy nie były zatwierdzone
(`git log --all -p | grep -E '^\+(GITHUB_CLIENT_SECRET|BETTER_AUTH_SECRET|DATABASE_URL)='` daje tylko wartości
przykładowe), `.env*` jest w `.gitignore`.

**2. Baza Neon** (plan Free, bez opłat; limity planu — storage, compute-hours, autosuspend — sprawdzić
w Neon → Billing w dniu wdrożenia):

1. Projekt z PostgreSQL **17**, region **AWS Europe Central 1 (Frankfurt)**, baza `shop`, właściciel np. `shop_owner`.
2. Connection string właściciela **direct** (bez `-pooler`) z `sslmode=verify-full` → `MIGRATION_DATABASE_URL`.
3. Sprawdzenie celu bez ujawniania hasła i wersji serwera:
   ```bash
   export DATABASE_URL='<direct URL właściciela>'   # tylko w tej sesji terminala
   npm run db:check -- --target-only                 # shop_owner@ep-….eu-central-1.aws.neon.tech:5432/shop … REMOTE
   npm run db:check                                  # wersja serwera, max_connections, TLS on, „_prisma_migrations not found”
   ```
4. Migracje i seed katalogu (tylko `migrate deploy`; nigdy `migrate dev`, `migrate reset`, `db push`):
   ```bash
   npx --no-install prisma migrate deploy            # 4 migracje Lab 08–09: CHECK, FK, unikalność koszyka, COLLATE "C"
   npx --no-install prisma migrate status            # Database schema is up to date
   npx --no-install prisma generate
   SEED_DEMO=false npx --no-install prisma db seed   # 4 kategorie, 100 produktów; konta, sesje i koszyki nietknięte
   npm run db:check                                  # tabele, nameSortKey COLLATE C, CHECK, unikalne (cartId, productId)
   ```
   To samo robi workflow „Migrate production database” (`confirm = production`, `seed_catalog = true`).
   Seed to upsert po `id`/`code` w jednej transakcji — ponowne uruchomienie nie duplikuje katalogu.
   Dla bazy zdalnej seed domyślnie **pomija fikcyjne konta demo** (`prisma/seed-options.ts`).
5. Rola runtime (Neon SQL Editor, jako właściciel): `CREATE ROLE shop_app WITH LOGIN PASSWORD '…'`, potem
   `scripts/sql/grant-app-role.sql`. Nadaje `SELECT/INSERT/UPDATE/DELETE` na wszystkich tabelach, `USAGE, SELECT`
   na sekwencjach, `ALTER DEFAULT PRIVILEGES` dla tabel i sekwencji z **przyszłych** migracji tego właściciela,
   bez `CREATE` w schemacie i bez dostępu do `_prisma_migrations`. Test: `tests/integration/app-role.test.ts`
   (rola czyta i zapisuje, sekwencje działają, `CREATE/DROP/ALTER` → `permission denied`, nowa tabela
   właściciela od razu dostępna).
6. Connection string `shop_app` z endpointu **pooled** (`-pooler`, PgBouncer w trybie transakcji)
   z `sslmode=verify-full` → `DATABASE_URL` w Vercel.

**3. Produkcyjna OAuth App GitHub** (osobna od lokalnej): Homepage URL `https://<domena>`, Authorization callback
URL `https://<domena>/api/auth/callback/github`. Client ID/secret → Vercel Production.

**4. Vercel** (Hobby): Add New Project → import repozytorium → Framework Next.js. Ustawienia wynikają z
`vercel.json` (Install `npm ci`, Build `npm run build`, region `fra1`) i `engines.node = 24.x`; w Settings →
Build and Deployment → Node.js Version: 24.x. Production branch: `main`. Zmienne z tabeli wyżej, tylko w
środowisku *Production*. `npx vercel link` lokalnie → `.vercel/project.json` (w `.gitignore`) daje
`orgId`/`projectId` → sekrety GitHub. Token: vercel.com → Account Settings → Tokens.

**5. GitHub**: Settings → Environments → `production` (secret `MIGRATION_DATABASE_URL`, variable
`PRODUCTION_URL`); Settings → Secrets → Actions (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).

**6. Wydanie**: PR `lab10 → main`, scalenie → `release.yml` → odbiór.

### Build a migracje — szczegóły

- **Generowanie klienta**: jawnie w buildzie — `"build": "prisma generate && next build"`, bez `postinstall`
  (nie dubluję mechanizmów). Klient powstaje zawsze z bieżącego `schema.prisma` w tym samym kroku co kompilacja,
  więc ani cache Vercel, ani artefakty lokalnego komputera nie mogą podać starego klienta (`lib/generated/`
  jest w `.gitignore`). `postinstall` odrzuciłam, bo `prisma.config.ts` wymaga `DATABASE_URL` już przy
  `generate` — `npm ci` w czystym checkoutcie bez zmiennych by się wysypał. W CI `prisma generate` jest osobnym
  krokiem przed lint/test (Listing 5.1); build generuje ponownie, co jest tanie i deterministyczne.
- **Czysty checkout sprawdzony** (`git clone` gałęzi `lab10` do pustego katalogu, bez `.env`, `node_modules`
  i `lib/generated`): `npm ci` → `prisma generate` → `lint` → `test` (27 plików, 392 testy) → `build` — wszystko OK
  (2026-11-10).
- **Dlaczego `migrate deploy` nie generuje Prisma Client**: aplikuje wyłącznie zatwierdzone pliki SQL z
  `prisma/migrations`, których nie ma jeszcze w `_prisma_migrations` — to operacja na **bazie**. Klient jest
  artefaktem **kodu** buildu (`prisma generate`); w Prisma 7 komendy migracji nie uruchamiają już `generate`
  ani seeda automatycznie. Operator migracji nie musi nawet budować aplikacji.
- **Dlaczego `migrate deploy` nie wykrywa pełnego driftu**: porównuje tylko listę (nazwy i sumy kontrolne)
  migracji z tabelą `_prisma_migrations`; nie introspektuje rzeczywistego schematu i nie używa shadow database.
  Ręczna zmiana w bazie (usunięty indeks, zmieniona kolacja, brakujący CHECK) przejdzie niezauważona. Dlatego
  `npm run db:check` sprawdza jawnie kolację `C`, liczbę CHECK i unikalność koszyka, a migracja `…_auth_cart`
  sama przerywa się, gdy brakuje CHECK ilości. Pełne porównanie: `prisma migrate diff` względem bazy.
- **Nieudana migracja**: `migrate deploy` zatrzymuje się na pierwszym błędzie, wiersz w `_prisma_migrations`
  zostaje oznaczony jako nieukończony, bramka w `release.yml` nie publikuje. Diagnoza z logu migracji, poprawka
  danych/SQL nową migracją albo `prisma migrate resolve` po ręcznym naprawieniu — **nigdy reset wspólnej bazy**.

### Pula połączeń, TLS i region

- `lib/prisma-client.ts`: pula `pg` na proces — `max = 5` (`DATABASE_POOL_MAX`, 1–50), `idleTimeoutMillis = 5 s`,
  `connectionTimeoutMillis = 10 s` (budzenie uśpionej bazy), `application_name = computer-shop`.
  `lib/db.ts`: jedna pula i jeden `PrismaClient` na proces (`globalThis`), `PrismaPg(pool)`.
- Współdzielony `PrismaClient` działa **w obrębie jednej instancji**. Vercel może uruchomić wiele instancji, każda
  z własną pulą, więc obciążenie bazy to *liczba instancji × max*. Dlatego aplikacja łączy się z endpointem
  **pooled** Neon (PgBouncer, tryb transakcji — tysiące połączeń klienckich na niewielką liczbę połączeń
  serwera), a mała pula ogranicza pojedynczą instancję. `PrismaPg` nie nazywa prepared statements, więc tryb
  transakcji PgBouncera jest zgodny. Migracje idą przez endpoint **direct** (blokady doradcze `migrate`).
- **Fluid Compute** (domyślny w Vercel): `attachDatabasePool(pool)` z `@vercel/functions` pozwala Vercel zamknąć
  bezczynne połączenia przed uśpieniem instancji, więc nie „wiszą” po stronie bazy. Poza Vercel funkcja nic nie
  robi (sprawdza `VERCEL_URL`/`VERCEL_REGION`).
- **TLS**: `sslmode=verify-full` w connection stringu — szyfrowanie i weryfikacja certyfikatu oraz nazwy hosta
  (CA Neon jest w magazynie Node). W kodzie nie ma `ssl: { rejectUnauthorized: false }`; test
  `tests/pool-config.test.ts` pilnuje, że konfiguracja puli nie nadpisuje `ssl`. `npm run db:check` wypisuje
  `TLS on/off` z `pg_stat_ssl`.
- **Regiony**: funkcje `fra1`, baza `aws-eu-central-1` — oba Frankfurt, opóźnienie zapytania rzędu
  pojedynczych ms zamiast ~100 ms przy domyślnym `iad1`.

## Lab 10 — testy i CI

| Polecenie | Co sprawdza |
| --- | --- |
| `npm run lint` | ESLint (Next.js 16 nie uruchamia go w `next build`) |
| `npm run test` | Vitest: 15 plików unit + 12 plików integracyjnych na **odrębnej, odtwarzanej** bazie `*_test` zmigrowanej przez `migrate deploy` — katalog, walidacja koszyka, autoryzacja i izolacja A/B, sesje, rola runtime, migracje |
| `npm run test:e2e` | Playwright: koszyk w przeglądarce na zbudowanej aplikacji i bazie `shop_e2e_test` |
| `npm run smoke -- <url> [--expect-sha <sha>]` | anonimowy test odbiorczy działającej aplikacji (lokalnie, CI, Production) |
| `npm run db:check` | cel połączenia (bez hasła), wersja serwera, `max_connections`, tabele, kolacja, CHECK |

Nowe testy Lab 10: `pool-config`, `log`, `auth-options` (reguły adresu na Vercel, `trustedOrigins`),
`seed-options`, `db-target`, `version`, `integration/app-role`, `e2e/cart.spec.ts`.

Wynik lokalny (2026-11-10, Node 24.22.1, PostgreSQL 17.11): `npm run lint` — 0 problemów; `npm run test` —
**27 plików, 392 testy, wszystkie zaliczone**; `npm run build` — OK; `npm run test:e2e` — **4/4**;
`npm run smoke -- http://localhost:3000 --expect-sha <HEAD>` — **15/15**. Workflowy sprawdzone `actionlint`
1.7.7 — bez uwag. ⟨link do zielonego przebiegu CI na GitHub⟩

## Lab 10 — test odbiorczy na Production

Automatyczna część (`npm run smoke -- https://<domena> --expect-sha <SHA>`, uruchamiana też przez `release.yml`):

| Sprawdzenie | Wynik lokalny 2026-11-10 | Production ⟨data, godzina⟩ |
| --- | --- | --- |
| `/api/version`: SHA = odbierany commit, Node 24 | PASS | ⟨⟩ |
| Strona główna bez szczegółów serwera | PASS | ⟨⟩ |
| 100 produktów, 4 kategorie, unikalne id i kody (brak duplikatów), ceny w całych groszach | PASS | ⟨⟩ |
| 8 kombinacji filtrów/sortowania = implementacja referencyjna Lab 06 (`queryProducts`) | PASS | ⟨⟩ |
| Błędny filtr → 400 bez szczegółów | PASS | ⟨⟩ |
| Szczegóły produktu, cena w złotych (`925,00 zł`) | PASS | ⟨⟩ |
| `/product-list/999999`, `abc`, `0` → własny widok 404 | PASS | ⟨⟩ |
| Obrazy produktów → 200 `image/*` | PASS | ⟨⟩ |
| Nieznany URL → własny 404 z linkiem powrotu | PASS | ⟨⟩ |
| `/basket`, `/order-history` bez sesji → zaproszenie do logowania, bez danych | PASS | ⟨⟩ |
| Brak cookie / podrobione cookie → brak sesji | PASS | ⟨⟩ |
| Start OAuth: `redirect_uri = <domena>/api/auth/callback/github`, tylko `read:user user:email` | PASS | ⟨⟩ |
| `callbackURL` w obcej domenie → 403 | PASS | ⟨⟩ |
| Żądanie z cookie z obcego `Origin` → 403 (CSRF) | PASS | ⟨⟩ |
| Callback z podrobionym `state` → przekierowanie, bez cookie sesji | PASS | ⟨⟩ |

Część ręczna (Tabela 7.1) — dwa konta GitHub, dwa czyste profile przeglądarki; dla zapisu sprawdzam też bazę
(Neon SQL Editor: `SELECT ci.id, ci."productId", ci.quantity FROM "CartItem" ci JOIN "Cart" c ON c.id = ci."cartId" JOIN "User" u ON u.id = c."userId" WHERE u.email = '<email>'`).
Tokenów, cookies ani danych drugiego konta tu nie zapisuję.

| Scenariusz | Kroki | Oczekiwane | Wynik ⟨czas⟩ | Dowód |
| --- | --- | --- | --- | --- |
| Katalog i szczegóły | `/product-list`, filtry, sortowania, `/product-list/1`, `/product-list/999999` | 100 produktów, ceny w zł, 404 dla braku | ⟨⟩ | smoke + zrzut |
| Logowanie i sesja | „Zaloguj przez GitHub” w czystym profilu | powrót na stabilną domenę, F5 nie wylogowuje | ⟨⟩ | pasek adresu, `/account` |
| Wylogowanie | wyloguj, potem w DevTools przywróć stare cookie i spróbuj dodać produkt | „Zaloguj się, aby zmieniać koszyk.”, brak zmian w bazie | ⟨⟩ | zapytanie SQL |
| Trwałość koszyka | dodaj, zmień ilość, usuń; wyloguj i zaloguj; po nowym wdrożeniu odśwież | koszyk zachowany | ⟨⟩ | SQL przed/po |
| Izolacja A/B | B w DevTools podmienia `itemId` w formularzu na pozycję A | „Nie znaleziono takiej pozycji…”, pozycja A bez zmian | ⟨⟩ | SQL |
| Walidacja | ilość 0/100 (po usunięciu `min`/`max`), więcej niż stan, akcja bez sesji | odmowa; suma liczona na serwerze | ⟨⟩ | komunikat + SQL |
| Ponowna publikacja | drobna zmiana UI → PR → nowy SHA | katalog, logowanie, zapis działają; nadal 100 produktów | ⟨⟩ | smoke `--expect-sha` |
| Nowy użytkownik | pierwsze logowanie drugiego konta | pusty koszyk, suma 0,00 zł, brak błędu | ⟨⟩ | zrzut |
| Nieznany URL i historia | `/xyz`, `/order-history` | własny 404; historia własnych zamówień (rozszerzenie Lab 09) | ⟨⟩ | zrzut |

Te same scenariusze koszyka są zautomatyzowane lokalnie w `e2e/cart.spec.ts` i w testach integracyjnych.

## Lab 10 — diagnostyka

**Gdzie szukać:** logi budowania — Vercel → Deployments → wdrożenie → *Build Logs* (oraz log joba `deploy`
w GitHub Actions); logi funkcji — Vercel → projekt → *Logs* (filtr: Production, poziom Error, ścieżka);
migracje — log workflow „Migrate production database”.

**Format logów:** `lib/log.ts` → jedna linia `[operacja] failed {"name","code","message"}`, np.
`[cart.addProduct] failed {"name":"Error","code":"53300",…}`. `redact()` usuwa dane logowania z connection
stringów, `password=`, cookies `better-auth.*`, `Bearer` i tokeny GitHub (`tests/log.test.ts`). Użytkownik
dostaje tylko ogólny komunikat („Nie udało się zapisać zmian…”, widok błędu z kodem `digest`), bez SQL
i szczegółów połączenia — sprawdza to smoke (`assertNoLeak`) i test „unreachable database”.

**Limity i liczba połączeń:** `npm run db:check` (z `DATABASE_URL` właściciela) wypisuje `max_connections` i liczbę
otwartych połączeń; w Neon → Monitoring: *Connections*, *Pooler client connections*; w Vercel → Usage: function
invocations, duration, Fluid CPU. Objawy wyczerpania połączeń: błędy `53300 too_many_connections` /
`remaining connection slots are reserved` albo `timeout exceeded when trying to connect` (pula czeka dłużej niż
10 s) w logach funkcji. Kontrola: `SELECT usename, application_name, state, count(*) FROM pg_stat_activity
GROUP BY 1,2,3` — połączenia aplikacji mają `application_name = computer-shop`. Uśpiona baza Neon daje
jednorazowo wolne pierwsze żądanie (zimny start), nie błąd.

**Kontrolowany eksperyment (lokalnie) — błędny adres powrotu OAuth:**

- *Objaw*: aplikacja uruchomiona na innym porcie niż `BETTER_AUTH_URL` (`next start -p 3100`, w `.env`
  `http://localhost:3000`). Strona i katalog działają, ale smoke test:
  `FAIL GitHub OAuth starts with a callback on this stable domain — redirect_uri=http://localhost:3000/api/auth/callback/github (BETTER_AUTH_URL wrong?)`
  (13 testów, 1 niezaliczony). W przeglądarce GitHub odesłałby użytkownika na inny adres — dokładnie ten błąd,
  który pojawia się po przeniesieniu do chmury z pozostawionym `BETTER_AUTH_URL=http://localhost:3000`.
- *Przyczyna*: Better Auth buduje `redirect_uri` z `BETTER_AUTH_URL`, nie z adresu żądania; OAuth App GitHub
  przyjmuje tylko zarejestrowany callback.
- *Zmiana*: aplikacja uruchomiona pod adresem zgodnym z `BETTER_AUTH_URL` (na Production: `BETTER_AUTH_URL` =
  stabilna domena + nowe wdrożenie, bo zmienne dotyczą tylko nowych wdrożeń). Dodatkowo `readAuthEnv` na Vercel
  odrzuca adres `localhost`/`http`/ze ścieżką już przy starcie.
- *Ponowny test*: `npm run smoke -- http://localhost:3000` → **14/14 PASS** (`redirect_uri=http://localhost:3000/api/auth/callback/github`);
  testy jednostkowe `auth-options` dla reguł na Vercel — zaliczone.

## Lab 10 — powrót do działającej wersji

- **Zasada**: `main` = to, co jest na Production. Podstawowa ścieżka: `git revert <SHA>` → PR → CI → `release.yml`
  publikuje commit z poprzednim kodem → smoke `--expect-sha` → nowy SHA w README.
- **Awaryjnie** (gdy liczy się czas): Vercel → Deployments → poprzednie wdrożenie Production → *Instant
  Rollback* (bez budowania; na Hobby tylko do bezpośrednio poprzedniego wdrożenia). Po rollbacku Vercel nie
  przypina automatycznie domeny do nowych wdrożeń — po naprawie trzeba *Promote*/„Undo Rollback”. Potem i tak
  revert w `main`, żeby kod i Production się zgadzały.
- **Rollback kodu nie cofa**: migracji (Prisma nie ma migracji „w dół”, `_prisma_migrations` zostaje), danych
  zapisanych przez nową wersję ani konfiguracji dostawcy (zmienne Vercel, ustawienia Neon, OAuth App). Dlatego
  migracje mają być zgodne wstecz (najpierw rozszerzenie schematu, usuwanie kolumn dopiero w kolejnym wydaniu),
  a przed zmianą destrukcyjną: sprawdzona kopia (`npm run db:backup-restore`, niżej) + plan odtworzenia
  (Neon: także odtworzenie gałęzi z punktu w czasie w ramach okna historii planu).
- **Ćwiczenie odbiorcze** (bez migracji): drobna zmiana interfejsu (np. tekst w stopce) → wydanie SHA₂ → koszyk
  konta A sprawdzony → revert → wydanie SHA₃ (kod jak SHA₁) → stopka/`/api/version` pokazują SHA₃, koszyk A
  bez zmian (SQL przed/po). ⟨SHA₁, SHA₂, SHA₃, czasy⟩

## Lab 10 — rozszerzenia

| Rozszerzenie | Stan | Efekt i test | Koszt utrzymania |
| --- | --- | --- | --- |
| **Automatyczne CI/CD** | zrobione (kod); dowód na GitHub ⟨link⟩ | `release.yml`: `deploy` ma `needs` na CI i bramkę migracji, Git-deploy Vercel wyłączony. Baza CI: kontener `postgres:17` w jobie (nigdy Production). Dowód zatrzymania: commit z celowo błędnym testem na `main` → job `checks` czerwony, `migrations-applied` i `deploy` *skipped*, na Vercel brak nowego wdrożenia, `/api/version` pokazuje stary SHA; revert → zielone wydanie. ⟨linki do obu przebiegów⟩ | ~6–8 min Actions na wydanie (darmowe minuty), utrzymanie tokenu Vercel i wersji CLI (`vercel@65.9.0`) |
| **Test przeglądarkowy koszyka** | zrobione, 4/4 lokalnie, krok w CI | `e2e/cart.spec.ts` (Playwright, Chromium): (1) bez sesji `/basket` prosi o logowanie, „Dodaj do koszyka” → serwer odmawia, 0 wierszy; (2) dodanie ×2, zmiana ilości na 3, odmowa 100 (po usunięciu `min/max` w DOM — waliduje serwer), odmowa ponad stan, usunięcie → pusty koszyk 0,00 zł, każdy krok sprawdzony w bazie; (3) wylogowanie usuwa sesję, stare cookie nie działa, nowe logowanie przywraca koszyk; (4) B z podmienionym `itemId` A → „Nie znaleziono…”, pozycja A bez zmian. Sesja tworzona w procesie testu (dostęp do bazy testowej + sekret testowy, `testUtils`) — **aplikacja nie ma żadnej trasy ani flagi obejścia OAuth**. Baza `shop_e2e_test` odtwarzana przy każdym uruchomieniu | ~10 s lokalnie, ~1 min w CI (instalacja Chromium); selektory po rolach/etykietach — zmiana tekstów UI wymaga zmiany testu |
| **Backup i restore** | zrobione lokalnie; dla Production ⟨wynik⟩ | `npm run db:backup-restore`: `pg_dump` 17 (kontener `postgres:17`, format custom, `--no-owner --no-privileges`) → nowa baza `*_test` → `pg_restore --exit-on-error` → porównanie wszystkich 11 tabel (liczba wierszy + md5 wszystkich wierszy), relacje bez sierot, CHECK/FK/kolacja jak w źródle. Odmawia przywracania do bazy bez sufiksu `_test` lub do źródła. Wynik lokalny: 0,4 s dump, 0,4 s restore, 11/11 tabel identycznych (Product 100, CartItem 3, Order 6…), 0 sierot, CHECK 14, FK 9, `COLLATE C` — „Restore verified”. Dla Production: `BACKUP_SOURCE_URL=<direct URL, tylko odczyt> RESTORE_DATABASE_URL=postgresql://…localhost…/shop_restore_test npm run db:backup-restore` — Production tylko czytany | Docker do `pg_dump`; plik w `backups/` (w `.gitignore`, zawiera dane osobowe — nie publikować) |
| **Pomiar wydajności** | zrobione lokalnie | `npm run perf -- <url>` — tabela niżej | brak (skrypt ręczny) |
| **Odrębne środowisko testowe** | przygotowane, ⟨do wykonania⟩ | Na Hobby (bez custom environments) najprościej: **drugi projekt Vercel** `computer-shop-staging` z tego samego repozytorium (Git-deploy też wyłączony), **gałąź Neon `staging`** (osobny endpoint i role), **osobna OAuth App** z callbackiem na domenę staging, osobny `BETTER_AUTH_SECRET`. Kod to obsługuje bez zmian (konfiguracja tylko ze zmiennych; reguły adresu dla `VERCEL_ENV`). Dowód izolacji: zapis do koszyka na staging, `npm run db:check` na obu bazach — liczby `CartItem` Production bez zmian | drugi zestaw sekretów i OAuth App do rotacji; gałąź Neon zużywa limit planu |

**Pomiar wydajności** — lokalnie, 2026-11-10: `next start` (build produkcyjny) + PostgreSQL 17.11 w Dockerze
na tym samym MacBooku, Node 24.22.1, dane testowe (100 produktów), 300 żądań na rundę rozdzielonych po kolei
między `/api/products?sort=name`, `/api/products?type=gpu&stock=available&sort=newest`, `/product-list/1`;
połączenia aplikacji liczone z `pg_stat_activity` co 25 ms; `max_connections = 100`.

Pierwsze żądanie po starcie procesu (pusta pula, nieskompilowane ścieżki): 132,7 ms / 14,5 ms / 55,7 ms;
kolejne żądania — jednocyfrowe ms.

| pula `max` | współbieżność | p50 ms | p95 ms | max ms | żądań/s | błędy | połączenia aplikacji (max) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 1 | 3,1 | 6,7 | 9,7 | 269 | 0 | 2 |
| 5 | 10 | 11,2 | 48,1 | 81,6 | 467 | 0 | 5 |
| 5 | 50 | 83,8 | 190,1 | 287,0 | 513 | 0 | 5 |
| 1 | 10 | 26,9 | 37,7 | 76,1 | 350 | 0 | 1 |
| 1 | 50 | 120,9 | 153,4 | 181,3 | 409 | 0 | 1 |

Wnioski: pula **nie przekracza `max`** nawet przy 50 równoczesnych żądaniach — nadmiar czeka w kolejce puli,
a nie otwiera nowych połączeń do bazy (to chroni limit bazy przy wielu instancjach). Przy `max = 1` przepustowość
spada o ~20%, a mediana rośnie — dla tej aplikacji 5 połączeń na instancję wystarcza. Pomiar lokalny nie
obejmuje opóźnienia sieci ani zimnego startu funkcji Vercel i budzenia bazy Neon; na Production obciążeniowo
nie testuję wspólnej bazy — ewentualny pomiar tylko na środowisku testowym.

## Lab 10 — odpowiedzi na pytania

**Dlaczego build i migracja to różne operacje?** Build zamienia commit w niezmienny artefakt: jest powtarzalny,
można go uruchomić wiele razy (CI, ponowienie, Preview) i nie zmienia danych. Migracja jednorazowo zmienia
**wspólny stan** bazy, wymaga praw DDL, zależy od kolejności i nie da się jej „odbudować”. Gdyby migrował każdy
build, każde budowanie (także z niezaufanego PR) dostawałoby hasło właściciela bazy Production, nieudany build po
udanej migracji zostawiałby nowy schemat ze starym kodem, a ponowienia uruchamiałyby DDL bez kontroli. Dlatego
u mnie build (`release.yml` / `vercel build`) nie ma `MIGRATION_DATABASE_URL`, a migracja jest osobnym etapem
operatora.

**Co zmienia nowy deploy w stosunku do istniejących danych?** Nic w bazie. Powstaje nowe, niezmienne wdrożenie
z nowym kodem i migawką zmiennych środowiska, a domena zaczyna wskazywać na nie. Konta, sesje, koszyki
i katalog zostają (seed nie jest częścią deployu, więc nie ma duplikatów). Zalogowani użytkownicy pozostają
zalogowani, dopóki `BETTER_AUTH_SECRET` i baza się nie zmieniają — zmiana sekretu unieważniłaby wszystkie
cookies. Schemat zmienia wyłącznie `migrate deploy`.

**Dlaczego wspólna baza Preview i Production może uszkodzić wydanie?** Preview uruchamia kod z niescalonych,
niezatwierdzonych gałęzi: mógłby zapisywać i kasować prawdziwe koszyki, dodać dane testowe do katalogu albo
zastosować migrację, której kod Production nie zna (schemat „z przyszłości”, kolizja nazw migracji). Do tego
podgląd z cudzego PR dostałby sekrety bazy produkcyjnej, a sesje i cookies obu środowisk mieszałyby się w jednej
tabeli. Dlatego Preview jest wyłączone, a środowisko testowe ma mieć osobną bazę i sekrety.

**Dlaczego rollback kodu nie przywraca poprzedniego schematu?** Rollback Vercel tylko przepina domenę na
starsze, gotowe wdrożenie — baza jest zewnętrznym, wspólnym stanem i nie jest częścią wdrożenia. Prisma stosuje
migracje tylko „w przód” (brak migracji w dół), a dane zapisane w nowych kolumnach i tak by zniknęły przy cofnięciu
schematu. Stary kod musi więc umieć pracować z nowym schematem (migracje zgodne wstecz), a cofnięcie schematu to
osobna, zaplanowana migracja albo odtworzenie z kopii.

**Jak testy wykrywają utratę autoryzacji po przeniesieniu do chmury?** (1) `readAuthEnv` na Vercel odrzuca
`localhost`, `http` i ścieżkę w `BETTER_AUTH_URL` — błędna konfiguracja kończy się błędem startu, nie cichą awarią;
testy jednostkowe to sprawdzają. (2) Smoke na Production weryfikuje, że `redirect_uri` wskazuje stabilną domenę
(eksperyment wyżej pokazał, że łapie błędny adres), że obcy `callbackURL` i obcy `Origin` dostają 403, a podrobione
cookie nie daje sesji. (3) Testy integracyjne i e2e sprawdzają, że każda operacja koszyka bez sesji kończy się
odmową, właściciel pochodzi z sesji, B nie zmienia pozycji A, a stare cookie po wylogowaniu nie działa — gdyby
w chmurze np. zabrakło sprawdzenia sesji albo zapis przechodził anonimowo, te testy by padły. (4) Ręczny odbiór
z dwoma kontami w czystych profilach potwierdza pełny przepływ GitHub, którego nie da się zautomatyzować bez
obejścia OAuth.

## Lab 10 — ograniczenia demonstracji

- Neon Free usypia bazę po kilku minutach bezczynności — pierwsze żądanie po przerwie jest wolniejsze (zimny
  start bazy + funkcji); limity planu (storage, compute-hours) mogą zatrzymać bazę do końca miesiąca.
- Preview wyłączone; środowisko testowe w chmurze opisane, ⟨nie / tak⟩ uruchomione.
- Składanie zamówień (checkout) nie jest wdrożone — przycisk „Złóż zamówienie” jest nieaktywny; historia zamówień
  (rozszerzenie Lab 09) pokazuje zamówienia przypisane do konta (na Production nie ma fikcyjnych zamówień demo,
  bo seed bazy zdalnej ich nie dodaje).
- Better Auth rate limit działa w pamięci instancji — na wielu instancjach Vercel limit jest per instancja.
- Ręczna część odbioru wymaga dwóch kont GitHub; nie ma automatycznego logowania na Production (celowo — brak
  obejścia OAuth).

## Lab 10 — nowe i zmienione pliki

| Plik | Rola |
| --- | --- |
| `vercel.json` | `npm ci`, `npm run build`, region `fra1`, wyłączone Git-deploye |
| `package.json` | `engines.node = 24.x`, `build = prisma generate && next build`, skrypty `db:check`, `db:status`, `db:backup-restore`, `smoke`, `perf`, `test:e2e` |
| `.github/workflows/ci.yml`, `release.yml`, `migrate.yml` | CI, wydanie zależne od testów i migracji, ręczne migracje |
| `lib/prisma-client.ts`, `lib/db.ts` | pula na instancję, `attachDatabasePool`, `application_name` |
| `lib/auth-options.ts` | reguły `BETTER_AUTH_URL` na Vercel, `trustedOrigins` |
| `lib/log.ts` | logi bez sekretów |
| `lib/version.ts`, `app/api/version/route.ts`, `next.config.ts`, `components/SiteFooter.tsx` | SHA wdrożonego commitu |
| `prisma/seed-options.ts`, `prisma/seed.ts` | seed bazy zdalnej tylko z katalogiem |
| `scripts/db-check.ts`, `scripts/lib/db-target.ts` | weryfikacja bazy i celu połączenia bez hasła |
| `scripts/sql/grant-app-role.sql` | prawa roli runtime |
| `scripts/smoke.ts`, `scripts/perf.ts`, `scripts/backup-restore.ts` | odbiór, pomiar, kopia |
| `e2e/*`, `playwright.config.ts` | test przeglądarkowy koszyka |

## Lab 10 — źródła

Vercel: Git integrations i `git.deploymentEnabled`, Plans (Hobby), Environment variables, Node.js versions,
Regions, Fluid Compute i `attachDatabasePool`, GitHub Actions z `vercel build --prebuilt`, Logs, Instant
Rollback. Prisma 7: Deploying database changes (`migrate deploy`), Deploy to Vercel, connection pooling,
`@prisma/adapter-pg`. Neon: connection pooling (PgBouncer), regions, roles, connect securely (`sslmode=verify-full`).
PostgreSQL 17: `GRANT`, `ALTER DEFAULT PRIVILEGES`, `pg_dump`/`pg_restore`, `pg_stat_activity`. Better Auth:
GitHub provider, options (`baseURL`, `trustedOrigins`), Next.js integration, `testUtils`. GitHub: OAuth Apps,
Actions for Node.js, service containers, environments. Playwright: fixtures, `webServer`, `globalSetup`.

---

# Lab 09 — logowanie i koszyk

Autorka: Anastasiia Muzyka

Sklep komputerowy (Programowanie BackEnd, KIS M-7, PK). Lab 06–07 dały katalog, routing i filtry w adresie,
Lab 08 — PostgreSQL 17 + Prisma 7. **Lab 09 dodaje logowanie GitHub OAuth (Better Auth 1.7.7), sesje
w PostgreSQL i własny koszyk użytkownika** z kontrolą właściciela po stronie serwera, atomowym `addProduct`
i testami A/B. Rozszerzenia: **historia użytkownika**, **sesje na wielu urządzeniach**, **zapis współbieżny**
(checkout transakcyjny — niewykonany, zob. Ograniczenia).

## Lab 09 — wersje

| Element | Wersja |
| --- | --- |
| Node.js / npm | 24.22.1 / 11.19.1 |
| Next.js / React | 16.3.8 / 19.2.8 |
| Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | 7.10.1 |
| PostgreSQL | 17.11 (`postgres:17`) |
| `better-auth` | **1.7.7** (`--save-exact`) |
| `@better-auth/prisma-adapter` | **1.7.14** (`--save-exact`, zgodnie z Listing 2.1; ciągnie własne `@better-auth/core@1.7.15`, typy zgodne — `tsc` bez błędów) |
| `auth` (CLI Better Auth, devDependency) | **1.7.7** (`--save-exact`), uruchamiane przez `npx --no-install auth` |

`npm ls better-auth @better-auth/prisma-adapter auth --depth=0` → `better-auth@1.7.7`,
`@better-auth/prisma-adapter@1.7.14`, `auth@1.7.7`. Lockfile zachowany i zatwierdzony. Bez Auth.js.

## Lab 09 — uruchomienie od zera

```bash
cp .env.example .env                      # hasło bazy + zmienne auth (poniżej)
openssl rand -base64 32                   # wynik → BETTER_AUTH_SECRET w .env
npm ci
npm run db:up
npx --no-install prisma migrate deploy    # 4 migracje, w tym …_auth_cart
npx --no-install prisma generate
npx --no-install prisma db seed           # katalog + fikcyjne konta demo (nie rusza kont z logowania)
npm run lint && npm run test && npm run build
npm run start                             # http://localhost:3000
```

### GitHub OAuth App (callback)

GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App (to nie jest GitHub App):

| Pole | Wartość lokalna |
| --- | --- |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

Client ID → `GITHUB_CLIENT_ID`, wygenerowany Client secret → `GITHUB_CLIENT_SECRET`. Przy zmianie portu lub
ścieżki auth trzeba zmienić oba adresy i `BETTER_AUTH_URL`. Adres wdrożenia — Lab 10.

Zakresy: `disableDefaultScope: true` + `scope: ["read:user", "user:email"]` (zob. `lib/auth-options.ts`) —
profil i e-mail, **bez `repo`**. Zweryfikowane na starcie OAuth: `scope=read:user user:email`,
`redirect_uri=http://localhost:3000/api/auth/callback/github`, losowy `state` i PKCE (`code_challenge_method=S256`).
Błąd braku e-maila (`?error=email_not_found` na `/login`): sprawdzić, czy aplikacja jest typu OAuth App (zakres
`user:email` wystarcza także dla prywatnego adresu); GitHub App wymaga osobnego uprawnienia „Email addresses: Read”.

### Zmienne środowiskowe auth

| Zmienna | Znaczenie |
| --- | --- |
| `BETTER_AUTH_SECRET` | losowy sekret (≥ 32 znaki; `openssl rand -base64 32` → 44) — podpis cookies, szyfrowanie tokenów OAuth |
| `BETTER_AUTH_URL` | bazowy URL, lokalnie `http://localhost:3000` (zaufane pochodzenie i `redirect_uri`) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | dane OAuth App, wyłącznie serwer |
| `DATABASE_URL` | baza z Lab 08 (bez zmian) |

Żadna nie ma prefiksu `NEXT_PUBLIC_`. `readAuthEnv()` (`lib/auth-options.ts`) sprawdza obecność, niepustość,
długość sekretu i poprawność URL **przy konfiguracji** i rzuca błąd z nazwą brakującej zmiennej — bez
`process.env.X as string`. W repozytorium jest tylko `.env.example` z wartościami zastępczymi.

## Lab 09 — integracja Better Auth

| Plik | Rola |
| --- | --- |
| `lib/auth-options.ts` | wspólne ustawienia (bez adaptera, bez `server-only`): sekret, `baseURL`, `socialProviders.github`, `session.cookieCache.enabled: false`, `account.encryptOAuthTokens: true` |
| `lib/auth.ts` | instancja runtime (`server-only`): `betterAuth({ ...shared, database: prismaAdapter(getPrisma(), { provider: "postgresql" }) })` — **ten sam klient PrismaPg z `lib/db.ts`**, bez drugiego klienta |
| `auth.ts` (katalog główny) | konfiguracja wyłącznie dla CLI: `import "dotenv/config"`, `betterAuth(shared)` bez adaptera aplikacji i bez `server-only` |
| `app/api/auth/[...all]/route.ts` | `toNextJsHandler(auth)` (Listing 4.1) |
| `lib/session.ts` | `getCurrentSession()` = `auth.api.getSession({ headers: await headers() })` — wywoływane w trakcie żądania (Listing 6.1) |
| `lib/auth-client.ts` | `createAuthClient()` z `better-auth/react`; `signIn.social({ provider: "github" })`, `signOut()` |
| `lib/return-path.ts` | powrót po logowaniu tylko na znane ścieżki (`/basket`, `/order-history`, …); inne → `/basket` |

Zabezpieczenia biblioteki zostają włączone: `state` + PKCE, sprawdzanie pochodzenia (`disableCSRFCheck` /
`disableOriginCheck` nieustawione), cookies `HttpOnly`, `SameSite=Lax`, podpisane sekretem (`Secure` przy HTTPS),
rate limiting w produkcji. Sprawdzone `curl` na `npm run start`: `POST /api/auth/sign-out` z cookie
i `Origin: https://evil.example` → `403 INVALID_ORIGIN`; `callbackURL: "https://evil.example"` →
`INVALID_CALLBACK_URL`; seria szybkich `sign-in` → „Too many requests”.

Po `signOut()` klient wywołuje `router.refresh()`, a logowanie kończy się pełnym przekierowaniem, więc
nawigacja (`UserMenu` — komponent serwerowy czytający sesję żądania) i widoki chronione zawsze pokazują stan
sesji serwera. Do przeglądarki trafia tylko nazwa użytkownika — bez tokenu sesji, tokenów OAuth i rekordów auth
(nie używam `useSession`, bo `get-session` zwraca w JSON także token sesji).

### Generowanie modeli i migracja

```bash
npx --no-install auth generate --config ./auth.ts --adapter prisma --dialect postgresql --output auth.prisma
# porównanie z prisma/schema.prisma, scalenie, usunięcie auth.prisma (jest też w .gitignore)
npx --no-install prisma validate
npx --no-install prisma migrate dev --create-only --name auth_cart
# przegląd SQL + dopisany blok sprawdzający CHECK ilości
npx --no-install prisma migrate dev
npx --no-install prisma generate
```

Decyzje przy scalaniu (`prisma/schema.prisma`):

- **Jeden model `User`** — z Lab 08 był już zgodny z Better Auth (string `id`, unikalny `email`,
  `emailVerified`, `image`, znaczniki czasu). Doszły relacje `sessions`, `accounts`. Nie ma drugiej tabeli
  użytkowników.
- Wygenerowane `@@map("user")`/`"session"`/… pominięte: adapter odwołuje się do modeli po nazwie
  (`prisma.user`, `prisma.session`), a tabele zachowują styl PascalCase całego schematu (`"User"`, `"Session"`,
  `"Account"`, `"Verification"`).
- `Account` dostał dodatkowo `@@unique([providerId, accountId])` — jedno konto GitHub należy do jednego
  użytkownika sklepu.
- `CartItem.product`: `Cascade` → **`Restrict`** (rozdz. 5: produktu w koszyku nie można usunąć — archiwizacja).
- `Cart`/`CartItem` powstały w Lab 08 razem z `UNIQUE(userId)`, `UNIQUE(cartId, productId)` i
  `CHECK (quantity BETWEEN 1 AND 99)`. Zastosowanych migracji nie edytuję, więc `20261103132555_auth_cart`
  dodaje tylko brakujące zmiany (tabele auth, indeksy, `Restrict`) i blok `DO $$ … RAISE EXCEPTION`, który
  przerywa migrację, gdyby `CHECK` ilości nie istniał. Bez `auth migrate`, bez `migrate reset`.

Seed (`prisma db seed`) wykonuje wyłącznie `upsert` katalogu i dwóch fikcyjnych kont demo — **nie usuwa
użytkowników, kont OAuth ani sesji** z logowania (test `seed.test.ts`). Konta OAuth i sesje tworzy wyłącznie
biblioteka; seed nie zawiera tokenów, a `.env` żadnego użytkownika.

## Lab 09 — koszyk

### Warstwy i miejsce ustalania właściciela

```
app/basket/page.tsx (Server Component, odczyt) ─┐
app/basket/actions.ts ("use server", mutacje) ──┼─> lib/cart/server.ts (server-only: sesja + klient)
                                                └─> lib/cart/cart-service.ts  ← ownerId(): session.user.id
                                                      walidacja (validation.ts), wyniki (types.ts)
                                                    lib/cart/cart-store.ts     ← SQL z warunkiem właściciela
```

**Właściciel jest ustalany w jednym miejscu: `ownerId()` w [lib/cart/cart-service.ts](lib/cart/cart-service.ts)**
— `(await getSession())?.user.id`, gdzie w aplikacji `getSession = getCurrentSession` z `lib/session.ts`
(Better Auth weryfikuje podpis cookie i wiersz `Session` w bazie przy każdym żądaniu). Żadna operacja nie
przyjmuje ID właściciela, koszyka, ceny ani sumy; nie ma zmiennej globalnej z bieżącym użytkownikiem ani cache
prywatnych wyników (wszystkie trasy renderują się przy żądaniu).

### Kontrakt operacji (Tabela 5.1)

| Operacja (serwis / Server Action) | Wejście | Rezultat |
| --- | --- | --- |
| `getMyCart()` | — | `{ signedIn: false }` albo koszyk właściciela; brak wiersza `Cart` = pusty koszyk, suma `0` (bez tworzenia rekordu); awaria bazy → wyjątek → `app/basket/error.tsx` (nigdy „pusty koszyk”) |
| `addProduct(productId)` / `addProductAction` | pole `productId` | +1 szt.; istniejąca pozycja zwiększa ilość, bez duplikatu; koszyk tworzony przy pierwszym zapisie |
| `setQuantity(itemId, quantity)` / `setQuantityAction` | `itemId`, `quantity` | ilość 1…99 i ≤ stan, tylko we własnej pozycji |
| `removeItem(itemId)` / `removeItemAction` | `itemId` | usunięcie własnej pozycji, odświeżenie podsumowania |

Każda mutacja zwraca kontrolowany wynik `{ ok: true, quantity? }` albo `{ ok: false, error, field?, message }`
(`unauthenticated`, `invalid_product_id`, `invalid_item_id`, `invalid_quantity`, `product_not_found`,
`out_of_stock`, `insufficient_stock`, `limit_reached`, `item_not_found`, `unavailable`). Nieoczekiwane błędy
(np. baza niedostępna) są logowane na serwerze, a użytkownik dostaje `unavailable` bez treści błędu ORM.
Akcje czytają z `FormData` tylko nazwane pola (zamknięty kontrakt; inne pola i obiekty są ignorowane/odrzucane)
i po sukcesie wywołują `revalidatePath("/basket")`; nie używają `redirect`, więc nie ma ryzyka przechwycenia
wyjątku przekierowania w `catch`.

### Polityka ilości i walidacja

- Wejście: liczba (`Number.isSafeInteger`) lub kanoniczny zapis dziesiętny `^(0|[1-9][0-9]*)$`; odrzucane
  `"1.5"`, `"1e2"`, `"-1"`, `" 3"`, `"01"`, `"0x10"`, obiekty, tablice.
- `productId` i `itemId` (`CartItem.id` = `SERIAL`, int4): 1…2147483647 (zakres z Lab 06).
- `quantity`: 1…99 **i** ≤ aktualny `Product.amount`. **Zero to błąd** `setQuantity` — usuwanie jest osobną
  operacją. Produkt o stanie 0 lub nieistniejący nie jest dodawany.
- Po spadku stanu pozycja dostaje `exceedsStock`; widok pokazuje komunikat i pozwala zmniejszyć ilość do stanu
  lub usunąć pozycję (zwiększenie ponad stan jest odrzucane).
- Koszyk **nie rezerwuje** towaru i nie zmienia `Product.amount`.
- Ceny i sumy liczy serwer z aktualnych danych produktu, w groszach: `lineTotal` i `total` jako `bigint`
  (int4 × 99 mieści się w double, ale suma wielu pozycji już nie musi); złote formatuje dopiero UI
  (`formatPrice` przyjmuje `bigint` bez utraty precyzji).
- Baza niezależnie od walidatora: `CHECK cart_item_quantity_range`, `UNIQUE(cartId, productId)`,
  `UNIQUE(userId)`, FK.

### Atomowość i właściciel w zapytaniu

- `addOne` (`lib/cart/cart-store.ts`): jedna transakcja — `INSERT INTO "Cart" … ON CONFLICT ("userId") DO UPDATE`
  (tworzy lub blokuje koszyk), potem `INSERT INTO "CartItem" … SELECT … WHERE amount >= 1 ON CONFLICT
  ("cartId","productId") DO UPDATE SET quantity = quantity + 1 WHERE quantity < 99 AND quantity < stan`.
  Równoległe żądanie czeka na konfliktujący wiersz i ponownie sprawdza warunek, więc dwa dodania dają +2,
  a przy jednej wolnej sztuce (lub jednym miejscu do 99) dokładnie jedno się udaje. Odrzucenie wycofuje
  transakcję, więc nie zostaje pusty nowy koszyk.
- `setQuantity`: jedno `UPDATE "CartItem" … FROM "Cart", "Product" WHERE ci.id = $item AND c."userId" = $owner
  AND p.amount >= $q`; `removeItem`: jedno `DELETE … USING "Cart" WHERE ci.id = $item AND c."userId" = $owner`.
  Sprawdzenie właściciela jest częścią mutacji (bez „sprawdź, potem zmień”). Cudza i nieistniejąca pozycja dają
  ten sam wynik `item_not_found`.

### Interfejs

- Nawigacja: „Zaloguj” (powrót do bieżącej sekcji) albo nazwa użytkownika (link do `/account`) i „Wyloguj”.
- `/basket`: bez sesji — czytelny widok z przyciskiem logowania (powrót na `/basket`); z sesją — pusty stan z sumą
  `0,00 zł` albo pozycje (obraz, nazwa, cena jednostkowa, ilość, wartość), suma i liczba sztuk.
- „Dodaj do koszyka” w katalogu i szczegółach (`AddToCartForm`), zmiana ilości (`QuantityForm`) i usuwanie
  (`RemoveItemForm`) przez `useActionState`: stan oczekiwania (`Dodawanie…`, `aria-busy`), komunikaty błędów
  z `role="alert"` powiązane z polem (`aria-invalid`, `aria-describedby`). Wyłączony przycisk dla niedostępnego
  produktu jest tylko podpowiedzią — serwer sprawdza wszystko ponownie.
- „Złóż zamówienie” jest wyłączony z opisem „Składanie zamówień nie jest jeszcze dostępne” — nie udaje
  zamówienia.

## Lab 09 — sesja i kontrola dostępu

- Każdy odczyt i każda mutacja koszyka/historii wywołuje `auth.api.getSession` z nagłówków bieżącego żądania.
  Brak sesji → `unauthenticated` bez zmian w bazie (to nie przekierowanie, tylko odmowa w samej operacji).
- `session.cookieCache.enabled: false` — każda weryfikacja czyta tabelę `Session`, więc wylogowanie, unieważnienie
  lub wygaśnięcie sesji działa od następnego żądania (test w `sessions.test.ts` pokazuje, że z włączonym cache
  unieważniona sesja byłaby akceptowana do końca `maxAge`).
- Moduły danych (`lib/cart/server.ts`, `lib/orders/server.ts`, `lib/auth.ts`, `lib/session.ts`, `lib/db.ts`)
  mają `server-only`; mutacje są w osobnym module `"use server"` (`app/basket/actions.ts`), nigdy inline w pliku
  `"use client"`.
- Ochrona CSRF własnych mutacji: Server Actions przyjmują tylko `POST` i Next.js porównuje `Origin` z `Host`
  (sprawdzone: obcy `Origin` → `Invalid Server Actions request`, akcja nie wykonana); cookie sesji `SameSite=Lax`.
- Nie ma `proxy.ts` — nie jest potrzebny, a i tak nie zastąpiłby kontroli w operacjach. Nie ma operacji
  listowania koszyków, `getAllUsersWithCarts()` ani `transferCart()`.

## Lab 09 — testy

`npm run test` → **359 testów: 185 unit (10 plików) + 174 integracyjne (11 plików)**, wszystkie zielone.
Integracyjne działają na osobnej bazie `shop_test` (strażnik nazwy z Lab 08), na własnych produktach testowych.

**Wiarygodny kontekst sesji:** `tests/integration/test-auth.ts` tworzy testową instancję Better Auth z tymi
samymi opcjami co aplikacja, adapterem Prisma na bazę testową i pluginem `testUtils` (tworzy prawdziwe wiersze
`Session` i poprawnie podpisane cookies). Serwis koszyka dostaje wyłącznie nagłówki, a właściciela ustala
`auth.api.getSession` — tak jak w aplikacji. Plugin nie rejestruje tras HTTP i **nie występuje w `lib/auth.ts`**,
więc nie jest publicznym obejściem logowania; sekrety testowe są stałe i fikcyjne.

| Plik | Co sprawdza |
| --- | --- |
| `tests/cart-validation.test.ts` | ilość 0, −1, 100, 1.5, `"1e1"`, `"05"`, NaN, 2^53, obiekty; zakres ID; pole błędu; ta sama odpowiedź dla cudzej i brakującej pozycji |
| `tests/return-path.test.ts` | `https://evil.example`, `//evil`, `/\evil`, `javascript:` → `/basket` |
| `tests/auth-options.test.ts` | brakujące/puste zmienne, krótki sekret, zły URL; dokładnie `GITHUB_CLIENT_ID/SECRET`, zakresy bez `repo`, cache wyłączony, brak `disable*Check` |
| `tests/format.test.ts` | złote z `bigint` dokładnie powyżej 2^53 |
| `cart-store.test.ts` | moduł danych z dwoma fikcyjnymi kontami: pusty koszyk bez rekordu, ceny i sumy z bazy, brak duplikatów, stan i limit 99, korekta po spadku stanu, A nie zmienia pozycji B, `Restrict` przy usuwaniu produktu |
| `cart-session.test.ts` | warstwa chroniona: właściciel z sesji, brak cookie, fałszywy cookie, token bez podpisu, sesja usunięta w bazie, wygasła, po `signOut`; podmiana ID na pozycję B; przemycone `userId`/`price`; błędne dane bez zmian; trwałość po „restarcie” (nowy klient) i ponownym logowaniu; niedostępna baza → `unavailable`, `getMyCart` rzuca |
| `cart-concurrency.test.ts` | równoległe `addProduct` (+2, jedna wolna sztuka → 1 sukces, 98 → 99, 12 prób przy stanie 5, wspólny koszyk), surowy SQL z ilością 0/100/−1, duplikat pary i drugi koszyk; rozszerzenie: `setQuantity‖setQuantity`, `setQuantity‖removeItem`, `removeItem‖removeItem` |
| `sessions.test.ts` | rozszerzenie: `signOut` vs `revokeOtherSessions` vs `revokeSessions` dla dwóch profili, wpływ `cookieCache` |
| `order-history.test.ts` | rozszerzenie: tylko własne zamówienia, numer zamówienia B = brak, niezmienność po zmianie ceny/nazwy i usunięciu produktu (`SetNull`), skrypt łączenia |
| `migrations.test.ts`, `seed.test.ts` | tabele auth obok jednego `User`, unikalne indeksy, akcje FK; seed nie usuwa użytkowników/sesji/koszyków |

### Wynik sprawdzeń (2026-11-03)

| Krok | Wynik |
| --- | --- |
| `npm ci` → `prisma migrate deploy` → `prisma generate` | OK |
| `npm run lint` | OK, bez ostrzeżeń |
| `npm run test` | OK — 359/359 |
| `npm run build` | OK; wszystkie trasy `ƒ` (nagłówek czyta sesję żądania) |
| `npm run start` — katalog z Lab 07 | `/product-list` z filtrami (`?type=gpu&stock=available&sort=newest`), szczegóły, obraz, `/catalog/gpu` → 200; `/product-list/abc` → 404 — bez zmian |
| Bezpośrednie wywołanie Server Action (`curl` z nagłówkiem `Next-Action`, z pominięciem formularza) | bez cookie i z fałszywym cookie: `addProductAction`, `setQuantityAction(itemId=1, quantity=50)`, `removeItemAction` → `{"ok":false,"error":"unauthenticated"}`; w bazie `CartItem` bez zmian (`1|1`, `2|2`) |
| To samo z `Origin: https://evil.example` | Next.js: `Invalid Server Actions request`, akcja niewykonana |

### Scenariusze odbioru A/B z prawdziwymi kontami GitHub (do pokazania na zajęciach)

Automatyczne testy powyżej pokrywają każdy wiersz Tabeli 8.1 na prawdziwych sesjach Better Auth. Demonstracji
z dwoma rzeczywistymi kontami GitHub w dwóch profilach przeglądarki **nie mogłam wykonać w tym środowisku** (brak
zarejestrowanej OAuth App i drugiego konta) — przebieg na `npm run start`, wynik obserwowany w bazie
(`docker compose exec postgres psql -U shop -d shop`):

1. Profil A i profil B logują się przez GitHub → w `"User"`, `"Account"` (`providerId = 'github'`), `"Session"`
   po jednym wierszu na profil; `/basket` pokazuje pusty koszyk i `0,00 zł`, w `"Cart"` brak wiersza.
2. A dodaje produkt dwa razy, zmienia ilość, usuwa → jedna pozycja w `"CartItem"`, suma z ceny w bazie.
3. A wpisuje w DevTools ilość `0`, `-1`, `1.5`, `100`, ilość > stan → komunikat przy polu, `"CartItem"` bez zmian.
4. A: DevTools → Network → powtórzenie żądania `setQuantityAction` z `itemId` pozycji B (ID z bazy) → „Nie
   znaleziono takiej pozycji w Twoim koszyku”; `SELECT * FROM "CartItem"` — pozycja B bez zmian. To samo dla
   `removeItemAction` i `/order-history/<numer zamówienia B>` (404).
5. A wylogowuje się, powtarza zapisane żądanie akcji → `unauthenticated`; `DELETE FROM "Session" WHERE …` dla B
   → następne żądanie B odrzucone.
6. Restart `npm run start` i ponowne logowanie A → koszyk A wraca; `docker compose stop postgres` → `/basket`
   pokazuje „Nie udało się wczytać koszyka”, akcja zwraca bezpieczny błąd.

## Lab 09 — rozszerzenia

### Historia użytkownika

- Modele `Order`/`OrderItem` ze snapshotem z Lab 08 (`productCode`, `productName`, `unitPrice` w groszach,
  `quantity`, `lineTotal`/`total` jako int8, `SetNull` na produkcie, `Restrict` na użytkowniku).
- Fixture: dwa fikcyjne konta (`demo-user` — `ZAM-2026-0001…0004`, `demo-user-b` — `0005…0006`) w seedzie.
- `/order-history` — wyłącznie zamówienia zalogowanego użytkownika (`lib/orders/order-service.ts` bierze
  właściciela z sesji, `order-store.ts` filtruje `userId` w zapytaniu); `/order-history/[number]` — cudzy
  i nieistniejący numer dają ten sam 404.
- Powiązanie z prawdziwymi kontami — kontrolowany lokalny skrypt (bez publicznego API):
  `npm run db:link-orders -- a <email konta A>` i `npm run db:link-orders -- b <email konta B>` (konto musi
  istnieć i mieć `Account` GitHub; jedna transakcja).
- Testy: podmiana numeru na zamówienie B, niezmienność po zmianie ceny/nazwy i po usunięciu produktu.

### Sesje na wielu urządzeniach

`/account` pokazuje aktywne sesje (urządzenie z User-Agent, daty; bez tokenów i ID) i trzy przyciski:
„Wyloguj to urządzenie” (`signOut` — usuwa tylko bieżący wiersz `Session`), „Wyloguj pozostałe urządzenia”
(`revokeOtherSessions`) i „Wyloguj wszędzie” (`revokeSessions`). Drugi profil jest odrzucany przy następnym
żądaniu, bo cookie cache jest wyłączony: przy `cookieCache.enabled` podpisane `session_data` w cookie
pozwalałoby drugiemu profilowi działać aż do `maxAge` (pokazane w `sessions.test.ts`) — szybkość kosztem
natychmiastowego unieważnienia.

### Zapis współbieżny

Polityka konfliktu: `setQuantity` zapisuje wartość bezwzględną jednym warunkowym `UPDATE` — blokada wiersza
szereguje równoległe zmiany i wygrywa ostatnia zatwierdzona (brak „lost update”, bo nie ma odczyt-modyfikacja-zapis).
Usunięcie jest ostateczne: późniejsze `setQuantity` nie znajduje własnego wiersza (`item_not_found`) i nie
przywraca pozycji. Test na dwóch sesjach tego samego użytkownika i dwóch pulach połączeń (po 10 rund).
Blokada przycisku w jednej przeglądarce nie pomaga: drugi profil, druga karta, powtórzone żądanie z DevTools lub
`curl` omijają stan UI — o poprawności decyduje warunek w bazie.

## Lab 09 — odpowiedzi na pytania

**Co potwierdza dostawca OAuth, a co sprawdza sklep?** GitHub potwierdza, że użytkownik zalogował się na konto
GitHub i zgodził się udostępnić profil i e-mail aplikacji o danym `client_id` (kod wymieniany na token po
stronie serwera z `client_secret`). Sklep sprawdza `state`/PKCE i pochodzenie żądania, tworzy własną sesję, przy
każdym żądaniu weryfikuje ją w bazie i **sam decyduje o uprawnieniach** — np. że pozycja należy do koszyka tego
użytkownika.

**Identyfikator GitHub, ID w bazie, token sesji.** `Account.accountId` to numeryczne ID konta GitHub (zewnętrzne,
z `providerId = 'github'`); `User.id` to losowy string nadany przez Better Auth — klucz obcy koszyka i zamówień
(niezależny od dostawcy i e-maila, który może się zmienić); token sesji (`Session.token`, w podpisanym cookie) to
tajny, wygasający dowód zalogowania jednej przeglądarki — można go unieważnić, nie zmieniając użytkownika.

**Dlaczego poprawny callback nie wystarcza do autoryzacji koszyka?** Callback tylko uwierzytelnia (kim jest
użytkownik) i tworzy sesję. Każda późniejsza operacja przychodzi osobnym żądaniem z dowolnymi danymi —
trzeba w niej zweryfikować sesję i sprawdzić, czy dany zasób należy do `session.user.id`.

**Limit ilości a dostępność przy zakupie.** Koszyk nie rezerwuje towaru: stan sprawdzany przy dodaniu może
spaść przez zakupy innych osób. Dostępność musi ponownie sprawdzić (i warunkowo zmniejszyć) transakcja
checkoutu.

**Unikalna para kluczy a kontrola właściciela.** `UNIQUE(cartId, productId)` wymusza najwyżej jedną pozycję
produktu w koszyku (brak duplikatów także przy wyścigu). Nie mówi nic o tym, kto może zmienić pozycję —
pozycja B jest w pełni poprawna, więc tylko warunek `c."userId" = session.user.id` chroni ją przed A.

**Cena z przeglądarki.** Wszystko, co wysyła klient, może być zmienione (DevTools, `curl`). Cenę i sumę liczy
serwer z `Product.price`; formularz przesyła tylko `productId`/`itemId`/`quantity`.

**`use server` a autoryzacja.** Dyrektywa tworzy publiczny endpoint POST, który może wywołać każdy, kto zna
ID akcji (jest w bundlu klienta). Nie sprawdza sesji ani uprawnień — robi to dopiero kod akcji
(`cartService` → `getSession`).

**Ukryty przycisk.** Akcję można wywołać, powtarzając żądanie z zakładki Network, `curl` z nagłówkiem
`Next-Action` albo z konsoli — sprawdziłam to dla akcji koszyka (wynik wyżej).

**Podmiana `itemId` na pozycję innej osoby.** `UPDATE`/`DELETE` z warunkiem właściciela dopasowuje 0 wierszy →
`item_not_found`, identycznie jak dla nieistniejącego ID; dane B się nie zmieniają i nic o nich nie wycieka
(testy `cart-store`, `cart-session`).

## Lab 09 — trasy

| URL | Zawartość |
| --- | --- |
| `/login?next=…` | logowanie przez GitHub; `next` tylko ze znanych ścieżek; komunikaty błędów OAuth |
| `/basket` | własny koszyk albo widok logowania |
| `/order-history`, `/order-history/[number]` | własne zamówienia (rozszerzenie) |
| `/account` | aktywne sesje i wylogowanie urządzeń (rozszerzenie) |
| `/api/auth/*` | endpointy Better Auth (`toNextJsHandler`) |
| `/`, `/product-list…`, `/catalog…`, `/about`, `/api/products` | bez zmian względem Lab 08 (+ „Dodaj do koszyka”) |

## Lab 09 — ograniczenia

- **Checkout transakcyjny nie jest zaimplementowany** (rozszerzenie opcjonalne): przycisk jest wyłączony,
  koszyk nie zmniejsza stanu.
- Demonstracja z dwoma prawdziwymi kontami GitHub wymaga zarejestrowanej OAuth App i wpisania jej danych do
  `.env`; tutaj sprawdzone automatycznie (prawdziwe sesje Better Auth) i `curl`-em bez sesji.
- Wszystkie trasy są dynamiczne (nagłówek czyta sesję) — świadomie, żeby nic prywatnego nie było prerenderowane
  ani buforowane wspólnie.
- `@better-auth/prisma-adapter@1.7.14` (wymagany przez instrukcję) używa `@better-auth/core@1.7.15`,
  a `better-auth@1.7.7` — `1.7.7`; działa i typuje się poprawnie, ale w `node_modules` są dwie kopie `core`.
- Next.js 16.3.8 ma znane podatności (`npm audit`) — wersję ustala prowadzący.

## Lab 09 — źródła

- Better Auth 1.7.7: Installation, Next.js integration (`toNextJsHandler`, `auth.api.getSession` z `headers()`),
  Prisma adapter i `auth generate --adapter prisma`, CLI, Database (core schema: user/session/account/
  verification), Session management (`cookieCache`, `revokeSessions`, `revokeOtherSessions`, `listSessions`),
  GitHub provider (zakresy `read:user`, `user:email`), Security (CSRF, origin check, `trustedOrigins`, cookies,
  rate limit), kod źródłowy pakietu (`social-providers/github.ts`, `plugins/test-utils`).
- GitHub Docs: Creating an OAuth App, Scopes for OAuth apps, różnice OAuth App / GitHub App.
- Next.js 16 (`node_modules/next/dist/docs`): Authentication, Data Security, Server Actions i `"use server"`
  (bezpieczeństwo, porównanie Origin/Host), `revalidatePath`, `useActionState`, `server-only`.
- PostgreSQL 17: `INSERT … ON CONFLICT DO UPDATE` (zachowanie przy współbieżności w READ COMMITTED),
  `UPDATE … FROM`, `DELETE … USING`, ograniczenia `CHECK`/`UNIQUE`/FK, `DO` + `RAISE`.
- Prisma 7: relacje i akcje referencyjne, interaktywne transakcje, `$queryRaw`/`$executeRaw` (parametryzowane).

---

# Lab 08 — baza danych (stan wyjściowy)

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

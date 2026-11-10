# Lab 10 — що зроблено і як підготуватися до показу

Шпаргалка українською: **що зроблено** в Lab 10, що ще треба доробити **до** заняття, що показувати **на**
занятті, де в коді що лежить і як відповідати на «Do wyjaśnienia». Повний опис польською — у `README.md`
(розділи «Lab 10 — …»), покрокова інструкція Neon/Vercel/GitHub — у `DEPLOY-STEPS.md`.
Підготовка до Lab 09 — у `PIDGOTOVKA-DO-ZDACHI.md`.

---

## Коротко: що зроблено в Lab 10

**Мета лабораторної:** розгорнути каталог і кошик (Lab 06–09) на стабільній HTTPS-адресі з віддаленою базою,
робочим GitHub OAuth поза моїм комп'ютером, стійким та ізольованим кошиком і повторюваним процесом публікації
конкретного коміту.

### Репозиторій і гілки
- Гілка `lab10` створена з `main` після Lab 09; усі зміни — малими комітами (≤ 10 слів, без co-author).
- `lab10` злита в `main` (merge-коміт), `main` на GitHub містить Lab 06–10; гілки `lab06`–`lab10` збережені.
- Реальних секретів в історії git ніколи не було (перевірено пошуком по всій історії); `.env*` у `.gitignore`.

### Конфігурація розгортання
- `vercel.json`: `npm ci`, `npm run build`, регіон **`fra1`** (Франкфурт), власні Git-деплої Vercel **вимкнені**
  — на Production потрапляє лише коміт, який пройшов перевірки (workflow **Release**).
- Node.js **24.x** (`engines.node`, CI, Vercel); backend лише в **Node.js Runtime** (`runtime = "nodejs"`).
- `build` = `prisma generate && next build` — клієнт Prisma генерується з актуальної схеми в кожному білді
  (без `postinstall`, без залежності від кешу).
- `.env.example` описує всі змінні для Development / Production без реальних значень.

### База даних (Neon)
- Проєкт Neon `autumn-credit-66579361`, регіон **Frankfurt** (поруч із `fra1`), **PostgreSQL 18.6**
  (у README треба вказати 18 або перейти на 17 — див. розділ 1).
- Міграції застосовано через `prisma migrate deploy` по **direct**-з'єднанню (4 міграції Lab 08–09:
  CHECK, зв'язки, унікальність кошика, `COLLATE "C"`), каталог: **4 категорії, 100 товарів**, без демо-акаунтів.
- Роль застосунку **`shop_app`**: лише `SELECT/INSERT/UPDATE/DELETE`, без DDL, з доступом до таблиць майбутніх
  міграцій (`scripts/sql/grant-app-role.sql`, тест `tests/integration/app-role.test.ts`).
- Застосунок ходить через **pooled**-endpoint (PgBouncer), пул `pg` = 5 з'єднань на інстанцію,
  `attachDatabasePool` для Fluid Compute, TLS `sslmode=verify-full`, `application_name = computer-shop`.

### Безпека й діагностика
- На Vercel застосунок **не стартує**, якщо `BETTER_AUTH_URL` = `localhost`, `http` або має шлях;
  `trustedOrigins` = рівно один домен, без `*.vercel.app`.
- Логи: `[операція] failed {name, code, message}` без паролів, connection string, cookies і токенів (`lib/log.ts`).
- `/api/version` і футер показують **SHA задеплоєного коміту**, середовище, регіон і версію Node.
- `npm run db:check` — перевірка бази (ціль із замаскованим паролем, версія, ліміти, таблиці, колація, CHECK).

### Тести і CI/CD
- Нові тести: пул, логи, правила auth на Vercel, seed, ціль бази, версія, роль `shop_app`.
  Разом **392 тести** (Vitest) + **4 браузерні** (Playwright) — усі зелені; перевірено й **чистий checkout**.
- `npm run smoke -- <url>` — 15 автоматичних перевірок задеплоєного застосунку (каталог, 404, картинки,
  сесії, адреса повернення OAuth, CSRF, SHA).
- GitHub Actions:
  - **CI** — lint → тести (окрема тестова база) → build → міграції + seed на порожній базі → smoke → Playwright;
  - **Migrate production database** — ручний запуск оператором (`confirm = production`);
  - **Release** — для `main`: CI → перевірка, що міграції застосовані → Vercel будує й публікує саме цей
    коміт → smoke на продакшн-домені з перевіркою SHA.

### Розширення (потрібне одне, зроблено чотири + інструкція п'ятого)
| Розширення | Стан |
| --- | --- |
| Автоматичне CI/CD | зроблено; треба показати на GitHub, що падіння тесту зупиняє реліз |
| Браузерний тест кошика | зроблено, 4/4 (локально і в CI), без обходу OAuth |
| Backup і restore | зроблено локально: 11/11 таблиць ідентичні, 0 «сиріт», CHECK/FK/колація збережені |
| Вимірювання продуктивності | зроблено локально: пул ніколи не перевищує `max` навіть при 50 паралельних запитах |
| Окреме тестове середовище | лише описано (другий проєкт Vercel + гілка Neon `staging` + окремий OAuth App) |

### Реальні проблеми, розв'язані під час розгортання (для розділу «diagnostyka»)
1. **`BETTER_AUTH_SECRET must have at least 32 characters`** у білді на GitHub Actions.
   *Симптом:* білд падав, хоча секрет у Vercel правильний. *Діагностика:* додала крок, що друкує **лише довжини**
   змінних — усі 5 мали по **11 символів** (заглушка). *Причина:* змінні Production у Vercel позначені
   **Sensitive**, CLI (`vercel pull`) отримує замість них заглушки. *Зміна:* Release тепер викликає
   `vercel deploy --prod`, білд іде на серверах Vercel, які бачать Sensitive-значення; SHA передається через
   `--build-env APP_COMMIT_SHA`. *Повторний тест:* новий запуск Release ⟨результат⟩.
2. **`PRODUCTION_URL` без `https://`** — GitHub попереджав «not a valid http(s) URL»; виправлено змінну.
3. **Default branch на GitHub = `lab06`** — змінено на `main` (і в Vercel Production branch = `main`).
4. **Неправильний пароль ролі `shop_app`** — змінено через `ALTER ROLE shop_app WITH PASSWORD '…'`.
5. **Справжній connection string потрапив у `.env.example`** — перехоплено до коміту, перенесено в
   `.env.production.local` (ігнорується git).
6. Локальний експеримент: застосунок на іншому порту, ніж `BETTER_AUTH_URL` → smoke ловить неправильний
   `redirect_uri` (описано в README).

---

## 0. Що потрібно мати

- Доступ до **Neon Console**, **Vercel** і **GitHub** (налаштування репозиторію й Actions).
- Робочий продакшн-домен, наприклад `https://computer-shop-2026p1.vercel.app` (далі `<DOMAIN>`).
- **Два акаунти GitHub** (свій + одногрупника) і **два профілі браузера** (або звичайне + інкогніто вікно).
- Локально: Docker Desktop (для тестів, backup і perf), `npm ci` виконано.

> ⚠️ На проєкторі **не відкривай** `.env`, `.env.production.local`, сторінку змінних у Vercel, секрети GitHub
> і cookies у DevTools. Логи Release безпечні — секретів там немає.

---

## 1. Що ще зробити ДО заняття

1. **Release зелений.** GitHub → Actions → Release → останній запуск: `checks`, `migrations already applied`,
   `publish to Vercel Production` — усі зелені. Якщо ні — див. таблицю помилок у `DEPLOY-STEPS.md` (Part 6.3).
2. **Перевірка домену:**
   ```bash
   curl -s <DOMAIN>/api/version            # commit = SHA останнього коміту main, environment = production, region = fra1
   npm run smoke -- <DOMAIN> --expect-sha <SHA>   # All 15 checks passed
   ```
3. **Вхід через GitHub** на `<DOMAIN>` у чистому профілі → повертає на `<DOMAIN>`, не на localhost.
4. **Ручний odbiór** (таблиця з розділу 3) з двома акаунтами — записати час і результат кожного рядка.
5. **Повторна публікація і rollback** (розділ 4) — записати SHA₁, SHA₂, SHA₃.
6. **Доказ CI/CD**: один червоний запуск Release (навмисно зламаний тест → `deploy` *skipped*) і наступний
   зелений після `git revert` — зберегти обидва посилання.
7. **Backup продакшну** у локальну тестову базу (лише читання продакшну):
   ```bash
   npm run db:up
   BACKUP_SOURCE_URL='<direct URL neondb_owner, sslmode=verify-full>' \
   RESTORE_DATABASE_URL='postgresql://shop:<пароль>@localhost:5432/shop_restore_test' \
   npm run db:backup-restore            # «Restore verified.»
   ```
8. **PostgreSQL 18**: у README (рядок «PostgreSQL» у «Lab 10 — wersje środowiska») написати
   `Neon PostgreSQL 18.6`, або створити проєкт Neon на 17.
9. **Заповнити всі `⟨…⟩` у README** (домен, SHA, посилання на PR і запуски CI, результати odbioru з часом) і
   додати діагностику з «Реальні проблеми» вище (пункт 1 — найкраща «rzeczywista naprawa»).
   Зробити це на гілці → PR → merge → Release → у README вказати SHA, який реально задеплоєний.

---

## 2. Що відкрити перед показом

1. **Браузер, профіль A** і **профіль B** на `<DOMAIN>`.
2. **Neon Console → SQL Editor** (гілка `production`, база `neondb`) — показувати результат **у базі**.
3. **GitHub → Actions** — останній зелений Release і червоний запуск (доказ CI/CD).
4. **Vercel → Deployments** (список деплоїв із SHA) і **Logs** (логи функцій).
5. **Редактор коду** з файлами з розділу 6.
6. **Термінал** для `npm run smoke -- <DOMAIN> --expect-sha <SHA>`.

Корисні SQL-запити:

```sql
-- кошики всіх користувачів (email можна не показувати — використовуй id)
SELECT u.id AS user_id, ci.id AS item_id, ci."productId", ci.quantity
FROM "CartItem" ci JOIN "Cart" c ON c.id = ci."cartId" JOIN "User" u ON u.id = c."userId"
ORDER BY u.id, ci.id;

-- сесії (без токенів!)
SELECT "userId", "expiresAt", "createdAt" FROM "Session" ORDER BY "createdAt" DESC;

-- каталог без дублікатів
SELECT count(*) AS products, count(DISTINCT code) AS codes FROM "Product";   -- 100 / 100
```

---

## 3. Сценарій показу (Tabela 7.1) — на `<DOMAIN>`

| # | Сценарій | Що зробити | Що має бути |
| --- | --- | --- | --- |
| 1 | Каталог і деталі | `/product-list`, фільтри (тип, наявність), сортування, `/product-list/1`, `/product-list/999999` | 100 товарів, ціни в zł (у базі — гроші), власний 404 |
| 2 | Вхід і сесія | A: «Zaloguj przez GitHub», потім F5 | повернення на `<DOMAIN>`, F5 не вилогінює |
| 3 | Стійкість кошика | A: додати 2×, змінити кількість на 3, видалити, додати знову; вийти й увійти | усе працює, кошик зберігся (SQL) |
| 4 | ⭐ Ізоляція | B: DevTools → Elements → змінити прихований `itemId` у своїй формі на `item_id` A з SQL → «Zmień» | «Nie znaleziono takiej pozycji w Twoim koszyku.», рядок A без змін (SQL) |
| 5 | Валідація | A: прибрати `min/max` у полі → `100`; потім більше, ніж на складі | відмова сервера, у базі без змін |
| 6 | Без сесії | вийти → «Dodaj do koszyka» | «Zaloguj się, aby zmieniać koszyk.» |
| 7 | Стара сесія | після виходу старе cookie не дає запису | (автоматично: `e2e/cart.spec.ts`, smoke «forged cookie») |
| 8 | Новий користувач | B — перший вхід | порожній кошик, сума 0,00 zł, без помилок |
| 9 | Невідомий URL і історія | `/xyz`, `/order-history` | власний 404 з посиланням назад; історія — власні замовлення / заклик увійти |
| 10 | Повторна публікація | новий SHA (розділ 4) | каталог, вхід і запис працюють, товарів досі 100 |

Також показати: `npm run smoke -- <DOMAIN> --expect-sha <SHA>` → 15/15, і `/api/version`.

**Сказати:** власник завжди береться із сесії (`session.user.id`), ніколи з форми; ціну рахує сервер;
сесія перевіряється в базі при кожному запиті (cookie cache вимкнено).

---

## 4. Повторна публікація і повернення (rollback)

1. Дрібна зміна інтерфейсу (наприклад, текст у футері) на гілці → PR → merge → Release → **SHA₂** у футері.
2. Перевірити кошик A (SQL до/після) — не змінився.
3. `git revert <коміт зі зміною>` → PR → merge → Release → **SHA₃**, футер як раніше, кошик A без змін.

**Сказати:**
- Основний спосіб — `git revert` + нова публікація (main = те, що на Production).
- Аварійно — Vercel **Instant Rollback** (без білду; на Hobby — лише до попереднього деплою), потім однаково
  revert у `main`.
- Rollback коду **не** відкочує міграції, дані й налаштування Vercel/Neon/OAuth; тому міграції мають бути сумісні
  назад, а перед руйнівною зміною — перевірена копія (`npm run db:backup-restore`).

---

## 5. Розширення — що показати

### Автоматичне CI/CD
Відкрити два запуски Release: червоний (тест зламаний навмисно → `checks` червоний, `migrations already applied`
і `publish to Vercel Production` — **skipped**, у Vercel нового деплою немає, `/api/version` — старий SHA) і
зелений після revert. **Сказати:** Git-деплої Vercel вимкнені в `vercel.json`, тому зелений CI — справжня
умова публікації, а не просто інформація. База для тестів CI — контейнер `postgres:17` у job, не продакшн.

### Браузерний тест кошика
```bash
npm run db:up && npm run build && npm run test:e2e      # 4 passed
```
**Сказати:** сесію створює тест (прямий доступ до тестової бази + тестовий секрет), у застосунку **немає**
жодного маршруту чи прапорця для обходу OAuth.

### Backup і restore
Показати вивід `npm run db:backup-restore` (таблиця «source / restored / same», «Restore verified.»).
Продакшн лише читається; відновлення — тільки в базу з назвою `*_test`.

### Вимірювання продуктивності
```bash
npm run build && npm run start          # в іншому терміналі:
npm run perf -- http://localhost:3000 --requests 300 --concurrency 1,10,50
```
**Сказати:** перший запит (холодний) повільніший; при 50 паралельних запитах з'єднань із базою все одно ≤ 5
(запити чекають у черзі пулу) — це захищає ліміт бази, коли інстанцій багато. Продакшн навантаженням не тестую.

### Окреме тестове середовище
Не розгорнуте; план: другий проєкт Vercel, гілка Neon `staging`, окремий OAuth App і секрети; доказ —
запис на staging не змінює `CartItem` у продакшн-базі.

---

## 6. Де що в коді (показати, якщо попросять)

| Що | Файл |
| --- | --- |
| Налаштування Vercel (регіон, команди, без Git-деплоїв) | `vercel.json` |
| Node 24, скрипти (`build`, `smoke`, `db:check` …) | `package.json` |
| CI / реліз / міграції | `.github/workflows/ci.yml`, `release.yml`, `migrate.yml` |
| Пул з'єднань, TLS, `application_name` | `lib/prisma-client.ts` |
| Один клієнт на процес, `attachDatabasePool` | `lib/db.ts` |
| Правила `BETTER_AUTH_URL` на Vercel, `trustedOrigins` | `lib/auth-options.ts` |
| Логи без секретів | `lib/log.ts` |
| SHA задеплоєного коміту | `next.config.ts`, `lib/version.ts`, `app/api/version/route.ts`, `components/SiteFooter.tsx` |
| Seed лише каталогу на віддаленій базі | `prisma/seed-options.ts`, `prisma/seed.ts` |
| Права ролі `shop_app` | `scripts/sql/grant-app-role.sql` |
| Перевірка бази / ціль без пароля | `scripts/db-check.ts`, `scripts/lib/db-target.ts` |
| Smoke / perf / backup | `scripts/smoke.ts`, `scripts/perf.ts`, `scripts/backup-restore.ts` |
| Браузерний тест | `e2e/cart.spec.ts`, `e2e/fixtures.ts`, `playwright.config.ts` |

---

## 7. Відповіді на «Do wyjaśnienia» (коротко)

- **Чому build і міграція — різні операції?** Build перетворює коміт на незмінний артефакт: його можна
  повторювати скільки завгодно, він не змінює даних. Міграція один раз змінює **спільний стан** бази, потребує
  прав DDL і не відкочується «перебудовою». Якби кожен білд мігрував, кожен білд (навіть із чужого PR) мав би
  пароль власника продакшн-бази, а невдалий білд після вдалої міграції залишив би нову схему зі старим кодом.
  У мене білд не має `MIGRATION_DATABASE_URL`, міграцію запускає оператор окремо.
- **Що змінює новий deploy щодо існуючих даних?** У базі — нічого. З'являється новий незмінний деплой із новим
  кодом і знімком змінних; домен переключається на нього. Акаунти, сесії, кошики й каталог лишаються; користувачі
  лишаються залогіненими, поки не змінено `BETTER_AUTH_SECRET`. Seed не входить у deploy → дублікатів немає.
- **Чому спільна база Preview і Production може зіпсувати реліз?** Preview запускає неперевірений код із гілок:
  він міг би змінювати справжні кошики, додати тестові дані або застосувати міграцію, якої продакшн-код не знає.
  Крім того, код із чужого PR отримав би секрети продакшн-бази. Тому Preview вимкнено.
- **Чому rollback коду не повертає попередню схему?** Rollback лише перемикає домен на старий деплой; база —
  зовнішній стан. Prisma застосовує міграції тільки «вперед», а дані в нових колонках при відкаті схеми зникли б.
  Тому міграції мають бути сумісні назад.
- **Як тести виявляють втрату авторизації після переїзду в хмару?** (1) Застосунок на Vercel не стартує з
  `BETTER_AUTH_URL` = localhost/http (юніт-тести). (2) Smoke на продакшні перевіряє, що `redirect_uri` вказує на
  стабільний домен, чужий `callbackURL` і чужий `Origin` → 403, підроблене cookie не дає сесії. (3) Інтеграційні
  та e2e тести: кожна операція кошика без сесії → відмова, B не змінює позицію A, старе cookie після виходу не
  працює. (4) Ручний odbiór із двома акаунтами в чистих профілях.

Додатково можуть спитати:
- **Чому `migrate deploy` не генерує Prisma Client?** Він лише застосовує SQL-файли міграцій до бази; клієнт —
  артефакт коду, його робить `prisma generate` у білді.
- **Чому `migrate deploy` не бачить повного driftu?** Він порівнює лише список міграцій із `_prisma_migrations`,
  а не реальну схему. Ручну зміну в базі не помітить — тому є `npm run db:check` (колація `C`, CHECK, унікальність).
- **Чому pooled для застосунку, а direct для міграцій?** Багато інстанцій × пул → PgBouncer тримає мало справжніх
  з'єднань; міграції потребують сесійних блокувань, яких немає в режимі транзакцій PgBouncer.
- **Що таке Sensitive у Vercel і чому білд іде на Vercel?** Значення Sensitive-змінних ніхто не може прочитати
  назад (навіть CLI), тому білд у GitHub Actions бачив заглушки; на серверах Vercel значення доступні.

---

## 8. Здача

- Посилання на репозиторій (прийнятим каналом), README з: адресою `<DOMAIN>`, SHA прийнятої версії, версіями,
  конфігурацією без секретів, процедурою відтворення бази й деплою, результатами odbioru, діагностикою, планом
  rollback, обмеженнями, посиланням на PR `lab10 → main` і SHA після злиття, списком розширень із результатами.
- `lab10` злита в `main` локально, тому PR `lab10 → main` порожній — у README пояснити це і вказати SHA злиття;
  для заповнення README зробити окремий PR (`lab10-acceptance → main`), щоб був реальний PR зі змінами.
- Гілки `lab06`–`lab10` **не видаляти**.

## 9. Чекліст перед виходом з дому

- [ ] Release на GitHub зелений, `/api/version` показує SHA, вказаний у README
- [ ] `npm run smoke -- <DOMAIN> --expect-sha <SHA>` → All 15 checks passed
- [ ] Вхід через GitHub працює в обох профілях на `<DOMAIN>`
- [ ] Друга людина з акаунтом B на місці (або домовлено)
- [ ] Є червоний і зелений запуск Release (доказ CI/CD), посилання в README
- [ ] Backup продакшну перевірено (`Restore verified.`)
- [ ] У README немає `⟨…⟩`, версія PostgreSQL правильна (18.6 або 17)
- [ ] Відкриті: два профілі браузера, Neon SQL Editor, GitHub Actions, Vercel Deployments, редактор коду
- [ ] `.env`, `.env.production.local`, змінні Vercel і секрети GitHub **закриті**; на екрані немає паролів і токенів
- [ ] Docker запущено (для e2e / backup / perf на занятті)

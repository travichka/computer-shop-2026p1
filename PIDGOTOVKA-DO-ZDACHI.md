# Як підготувати Lab 09 до показу викладачу

Покрокова шпаргалка: що зробити **до** заняття, що показувати **на** занятті, де в коді що лежить
і як відповідати на питання «Do wyjaśnienia». Повний опис рішень польською — у `README.md`
(розділи «Lab 09 — …»).

---

## 0. Що потрібно мати

- Запущений **Docker Desktop**.
- `.env` із заповненими змінними (вже зроблено): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`, `TEST_DATABASE_URL`.
- **Два реальні акаунти GitHub** — свій і, наприклад, одногрупника. Паролями не обмінюватися: друга людина
  входить сама у своєму профілі браузера.
- **Два окремі профілі браузера** (наприклад, Chrome «Профіль A» і Chrome «Профіль B», або Chrome + Firefox).
  Вкладка інкогніто теж підходить як другий профіль.
- Налаштування OAuth App на GitHubі (Settings → Developer settings → **OAuth Apps**):
  - Homepage URL: `http://localhost:3000`
  - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

> ⚠️ Під час показу **не відкривай `.env`** на проєкторі й не показуй значення cookie, токенів чи секретів
> (ні в DevTools, ні в базі). Таблицю `"Account"` показуй тільки зі стовпцями `"providerId"`, `"accountId"`,
> `"userId"`.

---

## 1. Підготовка напередодні (≈15 хв)

Усе з кореня проєкту, на гілці `lab09`:

```bash
git switch lab09
git status                                  # має бути чисто
npm ci                                      # чиста інсталяція з lockfile
npm run db:up                               # PostgreSQL 17 у Docker (чекає healthcheck)
npx --no-install prisma migrate deploy      # 4 міграції, зокрема …_auth_cart
npx --no-install prisma generate
npx --no-install prisma db seed             # каталог + 2 фіктивні користувачі (НЕ видаляє тих, хто входив)
npm run lint                                # без помилок і попереджень
npm run test                                # має бути 359 passed (185 unit + 174 integration)
npm run build
npm run start                               # http://localhost:3000
```

Перевір версії (викладач може попросити):

```bash
node -v                                                       # v24.x
npm ls better-auth @better-auth/prisma-adapter auth --depth=0  # 1.7.7 / 1.7.14 / 1.7.7
```

Пробний вхід: відкрий `http://localhost:3000`, натисни **«Zaloguj»**, увійди через GitHub — угорі має
з'явитися «Zalogowano: <ім'я>». Якщо все працює — вийди («Wyloguj»).

### Якщо щось не так

| Симптом | Що робити |
| --- | --- |
| `EADDRINUSE :3000` при `npm run start` | Старий сервер ще працює: `pkill -f next-server`, потім знову `npm run start` |
| `Cannot connect to the Docker daemon` | Запусти Docker Desktop, потім `npm run db:up` |
| GitHub: «redirect_uri is not associated with this application» | Callback в OAuth App має бути **точно** `http://localhost:3000/api/auth/callback/github` |
| На `/login` повідомлення про відсутній e-mail (`email_not_found`) | Перевір, що це **OAuth App**, а не GitHub App (GitHub App потребує окремого дозволу «Email addresses») |
| «Too many requests» | Спрацював rate limit Better Auth — зачекай 10–60 с |
| Після зміни `.env` нічого не змінилося | Перезапусти `npm run start` (за потреби спершу `npm run build`) |
| `Missing auth environment variables: …` | У `.env` бракує вказаної змінної або вона порожня |

---

## 2. Що відкрити перед показом

1. **Термінал 1** — `npm run start` (продакшн-версія, як вимагає інструкція).
2. **Термінал 2** — консоль бази, щоб показувати результат **у базі**, а не лише в UI:
   ```bash
   docker compose exec postgres psql -U shop -d shop
   ```
3. **Браузер, профіль A** і **профіль B** на `http://localhost:3000`.
4. **Редактор коду** з файлами з розділу 5.

Корисні SQL-запити (можна заздалегідь скопіювати):

```sql
-- користувачі та їхні GitHub-акаунти (без токенів!)
SELECT u.id, u.email, a."providerId", a."accountId"
FROM "User" u LEFT JOIN "Account" a ON a."userId" = u.id;

-- активні сесії (без стовпця token!)
SELECT id, "userId", "expiresAt", "userAgent" FROM "Session";

-- усі позиції кошиків із власниками
SELECT ci.id AS item_id, u.email, ci."productId", ci.quantity
FROM "CartItem" ci JOIN "Cart" c ON c.id = ci."cartId" JOIN "User" u ON u.id = c."userId"
ORDER BY ci.id;
```

---

## 3. Сценарій показу (Tabela 8.1)

Після кожного кроку запускай запит «усі позиції кошиків» у терміналі 2.

### 3.1 Вхід і порожній кошик
1. Профіль A → «Zaloguj» → GitHub → повернення. Угорі «Zalogowano: …».
2. `/basket` → «Twój koszyk jest pusty», сума `0,00 zł`.
3. У базі: з'явилися рядки в `"User"`, `"Account"` (`providerId = github`), `"Session"`; у `"Cart"` **немає**
   рядка — кошик створюється лише при першому записі.
4. Те саме в профілі B.

**Сказати:** OAuth лише підтверджує, хто користувач (автентифікація). Що йому можна — вирішує сервер
магазину при кожному запиті (авторизація).

### 3.2 Додавання, кількість, видалення
1. A: у каталозі «Dodaj do koszyka» двічі для одного продукту → у базі **одна** позиція з `quantity = 2`
   (без дубліката).
2. На `/basket` зміни кількість (поле + «Zmień») → видно «Zapisywanie…», потім нову суму.
3. «Usuń» → позиція зникає, сума оновлюється.
4. B теж додає щось у свій кошик (знадобиться для 3.4).

**Сказати:** ціна й сума рахуються на сервері з `Product.price`, у грошах (`bigint`); форма надсилає лише
`productId` / `itemId` / `quantity`.

### 3.3 Неправильні дані
DevTools (F12) → Elements → знайди `<input name="quantity">` у кошику A, прибери атрибути `min`/`max`
або просто введи значення й натисни «Zmień»:
- `0` → «Ilość musi być liczbą całkowitą od 1 do 99… Aby usunąć pozycję, użyj „Usuń”»
- `-1`, `1.5`, `100` → та сама помилка біля поля
- більше, ніж є на складі → «W magazynie nie ma tylu sztuk…»

У базі кількість **не змінилася**.

Недоступний продукт: у каталозі знайди продукт «Niedostępny», в Elements прибери атрибут `disabled` з кнопки
й натисни → «Produkt jest niedostępny.» — **прихована/вимкнена кнопка — не захист**, перевіряє сервер.

### 3.4 ⭐ Користувач A і дані B (найважливіше — 30% оцінки)
1. У терміналі 2 знайди `item_id` позиції **B**.
2. Профіль A → `/basket` → DevTools → Elements → у формі однієї зі своїх позицій знайди
   `<input type="hidden" name="itemId" value="…">` і заміни значення на `item_id` позиції B.
3. Натисни «Zmień» (або «Usuń»).
4. Результат: «Nie znaleziono takiej pozycji w Twoim koszyku.» — **та сама** відповідь, що й для
   неіснуючого ID (наприклад, `999999`).
5. У базі позиція B **без змін**.
6. Історія: A відкриває `/order-history/<номер замовлення B>` → 404, як для неіснуючого номера.

Альтернатива для 2–3 (через мережу): DevTools → Network → зроби звичайну зміну кількості → правий клік на
запит `POST /basket` → «Copy as cURL» → у терміналі заміни значення поля `1_itemId` на ID позиції B → виконай.
Відповідь: `{"ok":false,"error":"item_not_found",…}`.

**Сказати:** власник береться тільки із сесії (`session.user.id`), а перевірка власника — частина того самого
SQL `UPDATE`/`DELETE` (`… AND c."userId" = <власник>`), а не окрема перевірка перед зміною.

### 3.5 Немає сесії / кінець сесії
1. A у Network копіює запит зміни кількості як cURL («Copy as cURL»), потім натискає **«Wyloguj»**.
2. Виконує скопійований cURL ще раз (зі старим cookie) → `{"ok":false,"error":"unauthenticated",…}`, у базі
   без змін.
3. Те саме без cookie: видали з cURL рядок `-b '…'` / `-H 'cookie: …'` → `unauthenticated`.
4. Прострочена сесія B (у терміналі 2):
   ```sql
   UPDATE "Session" SET "expiresAt" = now() - interval '1 minute'
   WHERE "userId" = '<id користувача B>';
   ```
   B оновлює `/basket` → вид «Koszyk jest dostępny po zalogowaniu», а будь-яка дія → відмова.
   B просто входить знову.

**Сказати:** редирект на логін — не доказ відмови; відмова відбувається в самій операції (`unauthenticated`),
дані не змінюються.

### 3.6 Стійкість і збій бази
1. Зупини сервер (Ctrl+C) і знову `npm run start`; A входить знову → кошик A на місці.
2. `docker compose stop postgres` → оновити `/basket` → «Nie udało się wczytać koszyka» (а **не** порожній
   кошик); дія з каталогу → «Nie udało się zapisać zmian…» без технічних подробиць.
3. `docker compose start postgres` → усе знову працює.

### 3.7 SQL-обмеження і паралельне додавання
1. Обмеження бази в обхід валідатора (термінал 2, підстав `item_id` A):
   ```sql
   UPDATE "CartItem" SET quantity = 0   WHERE id = <item_id>;   -- ERROR: cart_item_quantity_range
   UPDATE "CartItem" SET quantity = 100 WHERE id = <item_id>;   -- ERROR: cart_item_quantity_range
   ```
2. Паралельне `addProduct` (+2, з одною вільною штукою — рівно один успіх, без дублікатів, не більше 99):
   ```bash
   npx vitest run tests/integration/cart-concurrency.test.ts
   ```

### 3.8 (за бажанням) Падіння складу після додавання
```bash
npm run db:set-amount -- <productId> 1     # стан продукту з кошика A → 1
```
На `/basket` у A з'являється «Dostępne są już tylko 1 szt. — zmniejsz ilość lub usuń pozycję», збільшити не
можна, зменшити до 1 або видалити — можна. Потім `npx --no-install prisma db seed` повертає демо-стани
(користувачів і сесії seed не чіпає).

---

## 4. Розширення (потрібне хоча б одне; зроблено три)

### Історія користувача
Перед показом прив'яжи демо-замовлення до реальних акаунтів (обидва мають уже хоч раз увійти):
```bash
npm run db:link-orders -- a <e-mail GitHub акаунта A>   # ZAM-2026-0001…0004
npm run db:link-orders -- b <e-mail GitHub акаунта B>   # ZAM-2026-0005…0006
```
Показати: A бачить на `/order-history` лише свої замовлення; `/order-history/ZAM-2026-0005` у A → 404.
Незмінність історії: `npm run db:set-amount` не потрібен — зміни ціну в базі
(`UPDATE "Product" SET price = 1 WHERE id = <productId із замовлення>;`) → в історії стара ціна (snapshot).
Після показу — `npx --no-install prisma db seed` повертає ціну.

### Сесії на кількох пристроях
1. Увійди тим самим акаунтом A у **двох** профілях браузера.
2. `/account` (клік по імені вгорі) → видно 2 сесії.
3. «Wyloguj pozostałe urządzenia» → у другому профілі після оновлення — вихід; у базі одна сесія.
4. «Wyloguj wszędzie» → обидва профілі розлогінені, у `"Session"` 0 рядків для A.

**Сказати:** cookie cache вимкнено (`cookieCache.enabled: false`), тому скасування діє одразу. З увімкненим
кешем інший профіль працював би до кінця `maxAge` — це показує тест `tests/integration/sessions.test.ts`.

### Паралельний запис
```bash
npx vitest run tests/integration/cart-concurrency.test.ts
```
Політика: `setQuantity` пише абсолютне значення одним `UPDATE` — перемагає останній; після видалення
`setQuantity` повертає `item_not_found` і не «воскрешає» позицію. Блокування кнопки в одному браузері не
рятує: є другий профіль, друга вкладка, повтор запиту з DevTools або `curl`.

Checkout (транзакційне оформлення) **не зроблено** — кнопка «Złóż zamówienie» вимкнена й чесно це пише.

---

## 5. Де що в коді (показати, якщо попросять)

| Що | Файл |
| --- | --- |
| **Де визначається власник із сесії** | `lib/cart/cart-service.ts` → функція `ownerId()` |
| Перевірка сесії поточного запиту | `lib/session.ts` → `getCurrentSession()` (`auth.api.getSession({ headers })`) |
| Конфігурація Better Auth (runtime) | `lib/auth.ts` (prismaAdapter + той самий Prisma-клієнт із `lib/db.ts`) |
| Спільні налаштування, перевірка env, scope GitHub | `lib/auth-options.ts` |
| Конфіг для CLI | `auth.ts` у корені |
| Handler `/api/auth/*` | `app/api/auth/[...all]/route.ts` |
| SQL з умовою власника, атомарний `addOne` | `lib/cart/cart-store.ts` |
| Валідація вводу | `lib/cart/validation.ts` |
| Server Actions (`"use server"`) | `app/basket/actions.ts` |
| Сторінка кошика | `app/basket/page.tsx` |
| Безпечний шлях повернення після входу | `lib/return-path.ts` |
| Міграція auth + Restrict | `prisma/migrations/20261103132555_auth_cart/migration.sql` |
| Тестова сесія (тільки в тестах, не в застосунку) | `tests/integration/test-auth.ts` |

---

## 6. Відповіді на «Do wyjaśnienia» (коротко)

- **Що підтверджує OAuth-провайдер, а що перевіряє магазин?** GitHub підтверджує, що людина увійшла у свій
  GitHub-акаунт і погодилася дати профіль та e-mail. Магазин перевіряє `state`/PKCE і походження запиту, сам
  створює сесію, перевіряє її при кожному запиті й сам вирішує про доступ до даних.
- **ID GitHub vs ID у базі vs токен сесії.** `Account.accountId` — ID акаунта GitHub (зовнішній).
  `User.id` — випадковий рядок від Better Auth, на нього посилаються кошик і замовлення. Токен сесії —
  секретний доказ входу однієї сесії; живе в підписаному cookie, його можна скасувати.
- **Чому правильний callback не авторизує кошик?** Callback лише автентифікує і створює сесію. Кожен
  наступний запит треба перевірити окремо: чи є дійсна сесія і чи ресурс належить `session.user.id`.
- **Чому ліміт у кошику не гарантує наявності при купівлі?** Кошик нічого не резервує; склад може змінитися.
  Перевіряти й зменшувати стан має транзакція checkoutу.
- **Що дає унікальна пара `(cartId, productId)`?** Немає дублікатів продукту в одному кошику (навіть при
  гонці). Але це не контроль власника: позиція B цілком коректна, захищає її лише умова на `userId`.
- **Чому ціні з браузера не можна вірити?** Усе з клієнта можна підмінити (DevTools, `curl`). Ціну й суму
  рахує сервер із бази.
- **Чому `use server` ≠ авторизація?** Директива робить функцію публічним POST-ендпоінтом. Викликати його може
  будь-хто, хто знає ID дії. Сесію перевіряє код дії.
- **Як викликати дію попри приховану кнопку?** Повтор запиту з Network, «Copy as cURL», зміна HTML у Elements.
- **Що буде при підміні `itemId` на чужий?** SQL з умовою власника змінює 0 рядків → `item_not_found`, так само
  як для неіснуючого ID; дані B не змінюються й нічого не розкриваються.
- **CSRF для власних мутацій?** Server Actions приймають лише POST, Next.js порівнює `Origin` із `Host`
  (чужий Origin → відмова); cookie сесії `SameSite=Lax`. Захисти Better Auth для `/api/auth/*` (origin check)
  увімкнено, `disableCSRFCheck`/`disableOriginCheck` не встановлено.

---

## 7. Здача (PR)

```bash
git push -u origin lab09
gh pr create --base main --head lab09 --title "Lab 09: GitHub OAuth, sesje w bazie i własny koszyk"
```
Гілку `lab09` **не видаляти** — затверджена версія буде основою для Lab 10.

## 8. Чекліст перед виходом з дому

- [ ] Docker запущено, `npm run test` → 359 passed
- [ ] `npm run build` і `npm run start` без помилок
- [ ] Вхід через GitHub працює в обох профілях
- [ ] Друга людина з акаунтом B на місці (або домовлено про спільну перевірку)
- [ ] Демо-замовлення прив'язані: `npm run db:link-orders -- a …` і `… b …`
- [ ] Відкриті: два профілі браузера, `psql`, редактор із `lib/cart/cart-service.ts`
- [ ] `.env` закритий, на екрані немає секретів і токенів
- [ ] PR із `lab09` до `main` створено

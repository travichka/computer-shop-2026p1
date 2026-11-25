# Lab 10 — deployment step by step (Neon → Vercel → GitHub)

Do the parts **in this order**: each part needs a value from the previous one.

| Part | What | About |
| --- | --- | --- |
| 1 | Neon: migrations, catalog, app role | 20 min |
| 2 | Vercel: create the project, learn the domain | 10 min |
| 3 | GitHub: production OAuth App | 5 min |
| 4 | Vercel: environment variables and settings | 10 min |
| 5 | GitHub: secrets for the workflows | 10 min |
| 6 | Release and checks | 15 min |
| 7 | Manual acceptance test and README | 30 min |

Rules for the whole guide:

- **Never** paste passwords, connection strings, tokens or client secrets into the README, a commit, a screenshot or a chat.
  They go only into: `.env` (local, git-ignored), Vercel → Environment Variables, GitHub → Secrets.
- Wherever you see `<DOMAIN>`, use your Vercel address **without** a trailing slash, for example
  `https://computer-shop-2026p1.vercel.app`.
- All terminal commands are run from the project folder:
  ```bash
  cd ~/BackEnd/lab6/computer-shop-2026p1
  ```

Already done (no action needed): code merged and pushed to `main`
(`512832df479c79590ee7f1b065e62243f5c3f903`), Neon project linked with `neon init`, `.env` contains the Neon
`DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) with your new password.

Your Neon project:

| | Value |
| --- | --- |
| Project ID | `autumn-credit-66579361` (organization `org-aged-night-93002292`) |
| Console | https://console.neon.tech/app/projects/autumn-credit-66579361/ |
| Region | AWS Europe (Frankfurt) `aws-eu-central-1` — matches Vercel `fra1` |
| Branch | `production` |
| Database / owner role | `neondb` / `neondb_owner` |
| Pooled host (for the app) | `ep-misty-wind-b97xvbx3-pooler.c-7.eu-central-1.aws.neon.tech` |
| Direct host (for migrations) | `ep-misty-wind-b97xvbx3.c-7.eu-central-1.aws.neon.tech` |
| PostgreSQL | **18.6** (see step 1.1) |

---

## Part 1 — Neon

### 1.1 Decide about the PostgreSQL version

The project runs PostgreSQL **18**; the lab materials and the README say **17**. The migrations work on 18.
Choose one:

- **Keep 18 (simpler):** nothing to do now; in Part 7 you write "PostgreSQL 18.6" in the README
  (row "PostgreSQL" in "Lab 10 — wersje środowiska").
- **Use 17 (exactly as in the lab):** Neon Console → *New Project* → Postgres version **17**, region
  **AWS Europe (Frankfurt)**, then in the terminal link it instead of the old one:
  `~/.npm-global/bin/neon init -y --agent claude-code --org-id org-aged-night-93002292 --project-id <NEW-PROJECT-ID>`.
  All hosts in this guide then change to the ones of the new project.

### 1.2 Make the Neon CLI available (once per terminal)

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
neon --version          # 9.3.2 or newer
neon me                 # shows your account → you are logged in
```

### 1.3 Apply the migrations (direct connection, owner role)

Migrations always go through the **direct** (unpooled) endpoint. The command below puts it into `DATABASE_URL`
**only for this terminal** and switches TLS to full certificate verification:

```bash
export DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env | cut -d= -f2- | tr -d '"' | sed 's/sslmode=require/sslmode=verify-full/')"

npm run db:check -- --target-only
```

Check the printed line — it must say `neondb_owner@ep-misty-wind-b97xvbx3.c-7…` (**no** `-pooler`), `sslmode=verify-full`,
`direct REMOTE`. If it says `localhost` or `-pooler`, stop and repeat the `export`.

```bash
npx --no-install prisma migrate deploy      # applies 4 migrations
npx --no-install prisma migrate status      # must say: Database schema is up to date!
```

Never use `prisma migrate dev`, `prisma migrate reset` or `prisma db push` on Neon.
If `migrate deploy` fails: **stop**, copy the error message (without the URL) and fix the cause — do not reset the database.

### 1.4 Load the catalog (once)

```bash
npx --no-install prisma generate
SEED_DEMO=false npx --no-install prisma db seed
```

Expected: `Seed OK: 4 categories, 100 products.` and `Demo accounts/orders skipped`.
Running it again is safe (no duplicates).

### 1.5 Verify the database

```bash
npm run db:check
```

Expected: `Migrations: 4 applied`, `Category 4 rows`, `Product 100 rows`, the other tables `0 rows`,
`Product.nameSortKey collation: C`, `CHECK constraints: 14; unique (cartId, productId): yes`.
(`TLS off` in the "Server" line is about Neon's internal connection; your connection is encrypted.)

Close this terminal afterwards (or run `unset DATABASE_URL`) so the owner URL does not stay in the environment.

### 1.6 Create the app role `shop_app` (read/write only, no DDL)

1. Generate a password in the terminal (letters and digits only, so it needs no URL encoding):
   ```bash
   openssl rand -hex 24
   ```
   Keep it in a password manager for the next steps.
2. Neon Console → your project → **SQL Editor**. At the top select branch **production**, database **neondb**
   (role `neondb_owner`).
3. Run (paste your password instead of `PASTE_PASSWORD`):
   ```sql
   CREATE ROLE shop_app WITH LOGIN PASSWORD 'PASTE_PASSWORD';
   ```
4. Open `scripts/sql/grant-app-role.sql` in VS Code, copy **the whole file**, paste it into the SQL Editor and run it.
   It must finish without errors. (It can be run again safely.)
5. Build the app's connection string — the **pooled** host, the `shop_app` role:
   ```text
   postgresql://shop_app:PASTE_PASSWORD@ep-misty-wind-b97xvbx3-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
   ```
   This is the **production `DATABASE_URL`** for Vercel (Part 4). Keep it in the password manager.
6. Test it locally without saving it anywhere:
   ```bash
   DATABASE_URL='<the shop_app URL from step 5>' npm run db:check
   ```
   Expected: `role shop_app`, `Product 100 rows`. The line `Migrations: _prisma_migrations not found` is **correct**
   here — the app role is deliberately not allowed to read the migration history.

(Shortcut, worse for grading: skip 1.6 and use the pooled `neondb_owner` URL from `.env` with
`sslmode=verify-full` as the production `DATABASE_URL`. The lab asks for separate roles, so prefer 1.6.)

### 1.7 Prepare the migration URL for GitHub

The **direct** owner URL with `sslmode=verify-full` — the same value you exported in 1.3. Print it once to copy it
into GitHub in Part 5, then clear the terminal:

```bash
grep '^DATABASE_URL_UNPOOLED=' .env | cut -d= -f2- | tr -d '"' | sed 's/sslmode=require/sslmode=verify-full/'
clear
```

This is `MIGRATION_DATABASE_URL`.

---

## Part 2 — Vercel: create the project

1. Go to https://vercel.com/signup → **Continue with GitHub** (plan **Hobby**, free).
2. **Add New… → Project → Import Git Repository**. If the repository is not listed: **Adjust GitHub App
   Permissions** → give the Vercel app access to `travichka/computer-shop-2026p1` (private personal repos are fine on Hobby).
3. Click **Import** on `computer-shop-2026p1`.
4. Configure screen:
   - Project Name: `computer-shop-2026p1` → this becomes the domain `https://computer-shop-2026p1.vercel.app`.
   - Framework Preset: **Next.js**. Root Directory: `./`.
   - Build/Install commands: leave as they are — `vercel.json` sets `npm ci` and `npm run build`.
   - Environment Variables: **leave empty here** (they are added in Part 4, only for Production).
5. Click **Deploy**. If a first deployment starts and **fails**, that is expected (no variables yet). It is also
   fine if no deployment starts at all — `vercel.json` disables Vercel's own Git deployments; Production is
   published by the GitHub *Release* workflow.
6. Project → **Settings → Domains**: note the production domain. If `computer-shop-2026p1.vercel.app` was taken,
   Vercel shows a different one — use **that** as `<DOMAIN>` everywhere below.

---

## Part 3 — GitHub: production OAuth App

Separate from your local one (the local app keeps the `localhost` callback).

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
2. Fill in:
   - Application name: `Computer Shop 2026 (production)`
   - Homepage URL: `<DOMAIN>`
   - Authorization callback URL: `<DOMAIN>/api/auth/callback/github`
     (e.g. `https://computer-shop-2026p1.vercel.app/api/auth/callback/github` — exact, `https`, no trailing slash)
   - Enable Device Flow: off.
3. **Register application**. Copy the **Client ID**.
4. **Generate a new client secret** → copy it immediately (GitHub shows it only once).

---

## Part 4 — Vercel: variables and settings

### 4.1 Environment variables

Project → **Settings → Environment Variables**. For **each** variable: Key, Value, Environments = **Production
only** (untick Preview and Development), **Save**.

| Key | Value |
| --- | --- |
| `DATABASE_URL` | the `shop_app` pooled URL from step 1.6.5 |
| `BETTER_AUTH_URL` | `<DOMAIN>` (e.g. `https://computer-shop-2026p1.vercel.app`) |
| `BETTER_AUTH_SECRET` | the **output** of `openssl rand -base64 32` — 44 characters ending with `=`, not the command itself, not your local one |
| `GITHUB_CLIENT_ID` | Client ID from Part 3 |
| `GITHUB_CLIENT_SECRET` | client secret from Part 3 |

Paste values **without quotes and without spaces** around them. **Sensitive** may stay on (Vercel turns it on
by default for Production): the Release workflow lets Vercel build the commit on its own builders, which can read
Sensitive values. Nobody — including the CLI and GitHub Actions — can read them back afterwards.
Do **not** add a `NEXT_PUBLIC_` prefix to anything.

### 4.2 Project settings

- **Settings → Build and Deployment → Node.js Version:** `24.x` → Save.
- **Settings → Environments → Production:** branch tracking = `main`.
- **Settings → Functions:** region shows **Frankfurt (fra1)** (comes from `vercel.json`; nothing to change).
- **Settings → Deployment Protection:** Vercel Authentication may stay on for Preview; Production must be public
  (the default on Hobby).

### 4.3 IDs for GitHub

In the terminal:

```bash
npx --yes vercel@65.9.0 login               # log in with GitHub in the browser
npx --yes vercel@65.9.0 link --yes --project computer-shop-2026p1
cat .vercel/project.json                    # {"projectId":"prj_…","orgId":"team_… or user id"}
```

`.vercel/` is git-ignored. Note `projectId` → `VERCEL_PROJECT_ID`, `orgId` → `VERCEL_ORG_ID`.

Token: https://vercel.com/account/settings/tokens → **Create Token** → name `github-actions-release`,
scope = your account, expiration e.g. 90 days → copy it (shown only once) → `VERCEL_TOKEN`.

---

## Part 5 — GitHub: secrets for the workflows

Repository https://github.com/travichka/computer-shop-2026p1 → **Settings**.

### 5.1 Environment `production`

**Settings → Environments → New environment** → name `production` → **Configure environment**:

- **Environment secrets → Add environment secret:** `MIGRATION_DATABASE_URL` = the direct owner URL from step 1.7.
- **Environment variables → Add environment variable:** `PRODUCTION_URL` = `<DOMAIN>` **including `https://`**,
  e.g. `https://computer-shop-2026p1.vercel.app`.
- Optional: *Deployment branches and tags* → **Selected branches** → add `main`.

If **Environments** is missing in Settings (GitHub Free does not offer environments for **private** repositories;
the GitHub Student Developer Pack gives Pro, which does), add both values as **repository** secret/variable in 5.2
instead — the workflows read them from either place. If a run then fails with an error about the environment,
the `environment:` lines in `.github/workflows/release.yml` and `migrate.yml` have to be removed.

### 5.2 Repository secrets

**Settings → Secrets and variables → Actions → Secrets → New repository secret**, three times:

| Name | Value |
| --- | --- |
| `VERCEL_TOKEN` | token from 4.3 |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

### 5.3 Actions allowed

**Settings → Actions → General → Actions permissions:** "Allow all actions and reusable workflows" → Save.

---

## Part 6 — Release and checks

### 6.1 Run the release

1. Repository → **Actions → Release → Run workflow** → Branch: `main` → **Run workflow**.
2. Wait for the three jobs (about 8–10 minutes):
   - `checks / lint · test · build · smoke · e2e` — green;
   - `migrations already applied` — green (if red with "Pending or failed migrations", repeat Part 1.3);
   - `publish to Vercel Production` — green; it also runs the smoke test on `<DOMAIN>`.
3. Open the run's **Summary**: "Released `<SHA>`" — this is the **deployed SHA** for the README.

(Pushing to `main` starts the same workflow automatically. The first push already started one that failed
because the secrets were missing — that run can be ignored.)

If you prefer not to use the workflow: run `npx --yes vercel@65.9.0 deploy --prod` from a clean checkout of
`main` — but then the "Automatyczne CI/CD" extension does not count.

### 6.2 Check the deployment

1. Open `<DOMAIN>/api/version` → `commit` must equal the SHA from 6.1, `environment: "production"`,
   `region: "fra1"`, `node` starts with `v24.`. The footer shows the short SHA too.
2. Smoke test from your computer:
   ```bash
   npm run smoke -- <DOMAIN> --expect-sha <SHA from 6.1>
   ```
   Expected: `All 15 checks passed`. Copy the output (it contains no secrets) for the README.
3. Vercel → project → **Logs** (filter Production): no red errors after opening a few pages.

### 6.3 If something fails

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build: `Cannot resolve environment variable: DATABASE_URL` | variable missing for Production | Part 4.1, then rerun Release |
| Build/log: `Missing auth environment variables: …` | variable missing or not ticked for Production | Part 4.1 |
| Build: `BETTER_AUTH_SECRET must have at least 32 characters` | the command was pasted instead of its output, or a short value | Part 4.1: paste the 44-character output |
| Annotation: `Environment URL '…vercel.app' is not a valid http(s) URL` | `PRODUCTION_URL` without `https://` | Part 5.1: `https://computer-shop-2026p1.vercel.app` |
| Log: `BETTER_AUTH_URL must be the public https:// domain on Vercel` | `localhost`/`http`/path in it | set exactly `<DOMAIN>`, rerun Release |
| GitHub: "The redirect_uri is not associated with this application" | callback in OAuth App ≠ `<DOMAIN>/api/auth/callback/github` | fix the OAuth App |
| Pages show "Nie udało się wczytać…", log `relation "Product" does not exist` | migrations not applied | Part 1.3–1.4 |
| Log `permission denied for table …` | grants missing for `shop_app` | Part 1.6 step 4 |
| Log code `28P01` (password authentication failed) | wrong password in `DATABASE_URL` | rebuild the URL (1.6.5), update Vercel, rerun Release |
| Log `53300` / `timeout exceeded when trying to connect` | too many connections / sleeping DB | wait and retry; check Neon → Monitoring |
| Release: `Error: Project not found` / `Not authorized` | wrong `VERCEL_*` secret or expired token | Part 4.3 + 5.2 |
| Release stops at "migrations already applied" | migration pending or `MIGRATION_DATABASE_URL` wrong | Part 1.3 / 1.7 |
| Vercel: `Deployment Blocked … commit author did not have contributing access` | the commit email is not linked to the GitHub account connected to the Vercel owner (Hobby, private repo) | use an email verified on that GitHub account (`git config user.email …`), connect GitHub in Vercel → Account → Authentication, make a new commit |

Changing a variable in Vercel affects only **new** deployments → always rerun Release after a change.

---

## Part 7 — Manual acceptance test and README

Use **two GitHub accounts** (the second can be a classmate's) in **two clean browser profiles** (or
one normal + one incognito window). Do not write cookies, tokens or the second person's data anywhere.

To check the database after a write: Neon Console → SQL Editor:

```sql
SELECT u.email, ci.id, ci."productId", ci.quantity
FROM "CartItem" ci JOIN "Cart" c ON c.id = ci."cartId" JOIN "User" u ON u.id = c."userId"
ORDER BY u.email, ci.id;
```

| # | Do | Expect |
| --- | --- | --- |
| 1 | `<DOMAIN>/product-list`, try filters and sorting, open a product, open `/product-list/999999` | 100 products, prices in zł, own 404 view |
| 2 | Account A: **Zaloguj przez GitHub** | returns to `<DOMAIN>` (not localhost); F5 keeps you logged in |
| 3 | A: add a product twice, change quantity to 3, remove it, add one again | works; SQL shows the row |
| 4 | A: sign out, sign in again | the cart is still there |
| 5 | B (other profile): first login | empty cart, total 0,00 zł, no error |
| 6 | B: add a product; DevTools → Elements → change the hidden `itemId` of B's row to A's `id` from SQL → **Zmień** | "Nie znaleziono takiej pozycji w Twoim koszyku."; A's row unchanged in SQL |
| 7 | A: DevTools → remove `min`/`max` on the quantity field → enter `100` → **Zmień**; then more than in stock | refused by the server |
| 8 | Sign out, open `/basket`, try "Dodaj do koszyka" on a product | "Zaloguj się, aby zmieniać koszyk." |
| 9 | `<DOMAIN>/xyz` and `/order-history` | own 404 with a way back; history page asks to sign in / shows own orders |
| 10 | Redeploy: change a text in the footer on a branch → PR → merge → Release | new SHA in `/api/version`, A's cart unchanged, still 100 products |
| 11 | Rollback: `git revert` the footer commit → PR → merge → Release | old footer, new SHA, cart unchanged |

Note the time and result of each row.

### Fill in the README

On a new branch from `main`:

```bash
git switch main && git pull
git switch -c lab10-acceptance
```

In `README.md`, section "Lab 10", replace every `⟨…⟩` with real values: `<DOMAIN>`, the deployed SHA,
the PR link, the smoke output, the table of manual results with times, the SHAs of the redeploy/rollback,
the links to the green CI run and to a red run (extension CI/CD, see below), and the PostgreSQL version
(18.6 if you kept the project). Then:

```bash
git add README.md
git commit -m "Record Lab 10 acceptance results and deployed SHA"
git push -u origin lab10-acceptance
```

Open a pull request `lab10-acceptance → main` on GitHub, merge it, and the Release runs again — check that
`/api/version` shows the new SHA.

### Proof for the CI/CD extension (failing test stops the release)

1. On a branch, make one test fail on purpose, e.g. in `tests/format.test.ts` change an expected value.
2. Push, open a PR, merge it to `main`.
3. Actions → Release: `checks` is **red**, `migrations already applied` and `publish to Vercel Production` are
   **skipped**; `<DOMAIN>/api/version` still shows the previous SHA. Save the link to this run.
4. Revert the change (`git revert`), PR, merge → Release green → new SHA live. Save that link too.

---

## Local development after `neon init`

`neon init` replaced `DATABASE_URL` in `.env` with Neon, so `npm run dev` now uses the **production** database.
To go back to the local Docker database, set this line in `.env` again (password = `POSTGRES_PASSWORD` from `.env`):

```text
DATABASE_URL=postgresql://shop:<POSTGRES_PASSWORD>@localhost:5432/shop
```

Note: `neon env pull` overwrites `DATABASE_URL` again. Tests are not affected: they use `TEST_DATABASE_URL`
(local Docker) and refuse to run against any database whose name does not end with `_test`.
